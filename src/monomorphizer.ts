import * as ast from "./ast.js";

function formatTypeName(typeNode: ast.TypeNode): string {
  if (typeNode.kind === "PrimitiveType") {
    if (typeNode.typeArgs && typeNode.typeArgs.length > 0) {
      const args = typeNode.typeArgs.map(formatTypeName).join("_");
      return `${typeNode.name}_${args}`;
    }
    return typeNode.name;
  }
  if (typeNode.kind === "ArrayType") return `${formatTypeName(typeNode.elementType)}Array`;
  if (typeNode.kind === "PointerType") return `${formatTypeName(typeNode.pointeeType)}Ptr`;
  if (typeNode.kind === "ResultType") return `Result_${formatTypeName(typeNode.okType)}_${formatTypeName(typeNode.errType)}`;
  if (typeNode.kind === "MapType") return `Map_${formatTypeName(typeNode.valueType)}`;
  if (typeNode.kind === "NullableType") return `${formatTypeName(typeNode.innerType)}Nullable`;
  return "Unknown";
}

export class Monomorphizer {
  private genericStructs = new Map<string, ast.StructDecl>();
  private genericFunctions = new Map<string, ast.FunctionDecl>();
  private instantiatedStructs = new Set<string>();
  private instantiatedFunctions = new Set<string>();
  private specializedDecls: ast.Declaration[] = [];

  // Deep clone helper using JSON
  private cloneNode<T>(node: T): T {
    return JSON.parse(JSON.stringify(node));
  }

  public monomorphize(program: ast.Program): ast.Program {
    const newProgram = this.cloneNode(program);
    const nonGenericDecls: ast.Declaration[] = [];

    // Pass 1: Collect generics
    for (const decl of newProgram.declarations) {
      if (decl.kind === "StructDecl" && decl.typeParams && decl.typeParams.length > 0) {
        this.genericStructs.set(decl.name.name, decl);
      } else if (decl.kind === "FunctionDecl" && decl.typeParams && decl.typeParams.length > 0) {
        this.genericFunctions.set(decl.name.name, decl);
      } else {
        nonGenericDecls.push(decl);
      }
    }

    newProgram.declarations = nonGenericDecls;

    // Pass 2: Traverse and instantiate in the non-generic AST
    for (const decl of newProgram.declarations) {
      this.visitDeclaration(decl, new Map());
    }

    // Pass 3: Append all newly instantiated specialized declarations
    newProgram.declarations.push(...this.specializedDecls);

    return newProgram;
  }

  // Substitution map maps a TypeParameter name (e.g. "T") to a concrete TypeNode (e.g. PrimitiveType("i32"))
  private visitDeclaration(decl: ast.Declaration, substitutions: Map<string, ast.TypeNode>) {
    if (decl.kind === "StructDecl") {
      for (const field of decl.fields) {
        field.type = this.visitType(field.type, substitutions);
      }
    } else if (decl.kind === "FunctionDecl") {
      for (const param of decl.params) {
        param.type = this.visitType(param.type, substitutions);
      }
      if (decl.returnType) {
        decl.returnType = this.visitType(decl.returnType, substitutions);
      }
      this.visitBlock(decl.body, substitutions);
    }
  }

  private visitBlock(block: ast.Block, substitutions: Map<string, ast.TypeNode>) {
    for (const stmt of block.statements) {
      this.visitStatement(stmt, substitutions);
    }
  }

  private visitStatement(stmt: ast.Statement, substitutions: Map<string, ast.TypeNode>) {
    switch (stmt.kind) {
      case "LetStatement":
      case "ConstStatement":
        if (stmt.type) stmt.type = this.visitType(stmt.type, substitutions);
        if (stmt.initializer) this.visitExpression(stmt.initializer, substitutions);
        break;
      case "ExpressionStatement":
        this.visitExpression(stmt.expression, substitutions);
        break;
      case "ReturnStatement":
        if (stmt.value) this.visitExpression(stmt.value, substitutions);
        break;
      case "IfStatement":
        this.visitExpression(stmt.condition, substitutions);
        this.visitBlock(stmt.thenBlock, substitutions);
        if (stmt.elseBlock) {
          if (stmt.elseBlock.kind === "Block") this.visitBlock(stmt.elseBlock, substitutions);
          else this.visitStatement(stmt.elseBlock, substitutions);
        }
        break;
      case "WhileStatement":
        this.visitExpression(stmt.condition, substitutions);
        this.visitBlock(stmt.body, substitutions);
        break;
      case "ForStatement":
        if (stmt.init) this.visitStatement(stmt.init, substitutions);
        if (stmt.condition) this.visitExpression(stmt.condition, substitutions);
        if (stmt.update) this.visitExpression(stmt.update, substitutions);
        this.visitBlock(stmt.body, substitutions);
        break;
      case "ForInStatement":
        this.visitExpression(stmt.start, substitutions);
        this.visitExpression(stmt.end, substitutions);
        this.visitBlock(stmt.body, substitutions);
        break;
    }
  }

  private visitExpression(expr: ast.Expression, substitutions: Map<string, ast.TypeNode>) {
    switch (expr.kind) {
      case "BinaryExpr":
        this.visitExpression(expr.left, substitutions);
        this.visitExpression(expr.right, substitutions);
        break;
      case "UnaryExpr":
      case "PostfixExpr":
      case "CloneExpr":
        this.visitExpression(expr.operand || (expr as any).expr, substitutions);
        break;
      case "CallExpr":
        this.visitExpression(expr.callee, substitutions);
        for (const arg of expr.args) {
          this.visitExpression(arg, substitutions);
        }
        break;
      case "FieldAccessExpr":
        this.visitExpression(expr.object, substitutions);
        break;
      case "IndexAccessExpr":
        this.visitExpression(expr.object, substitutions);
        this.visitExpression(expr.index, substitutions);
        break;
      case "AssignmentExpr":
        this.visitExpression(expr.target, substitutions);
        this.visitExpression(expr.value, substitutions);
        break;
      case "CastExpr":
        expr.targetType = this.visitType(expr.targetType, substitutions);
        this.visitExpression(expr.expr, substitutions);
        break;
      case "AllocExpr":
        this.visitExpression(expr.sizeExpr, substitutions);
        break;
      case "ArrayLiteral":
        for (const el of expr.elements) {
          this.visitExpression(el, substitutions);
        }
        break;
      case "StructLiteral":
        if (expr.typeArgs && expr.typeArgs.length > 0) {
          expr.typeArgs = expr.typeArgs.map(t => this.visitType(t, substitutions));
          expr.name = this.instantiateStruct(expr.name, expr.typeArgs);
          delete expr.typeArgs;
        }
        for (const field of expr.fields) {
          this.visitExpression(field.value, substitutions);
        }
        break;
      case "Identifier":
        if (expr.typeArgs && expr.typeArgs.length > 0) {
          expr.typeArgs = expr.typeArgs.map(t => this.visitType(t, substitutions));
          expr.name = this.instantiateFunction(expr.name, expr.typeArgs);
          delete expr.typeArgs;
        }
        break;
    }
  }

  private visitType(typeNode: ast.TypeNode, substitutions: Map<string, ast.TypeNode>): ast.TypeNode {
    if (typeNode.kind === "PrimitiveType") {
      // Check if it's a type parameter being substituted
      if (substitutions.has(typeNode.name) && (!typeNode.typeArgs || typeNode.typeArgs.length === 0)) {
        return this.cloneNode(substitutions.get(typeNode.name)!);
      }
      
      // Check if it's a generic struct being explicitly instantiated
      if (typeNode.typeArgs && typeNode.typeArgs.length > 0) {
        typeNode.typeArgs = typeNode.typeArgs.map(t => this.visitType(t, substitutions));
        const newName = this.instantiateStruct(typeNode.name, typeNode.typeArgs);
        
        // Erase typeArgs, transform into concrete PrimitiveType
        return {
          kind: "PrimitiveType",
          name: newName,
          line: typeNode.line,
          column: typeNode.column
        };
      }
    } else if (typeNode.kind === "ArrayType") {
      typeNode.elementType = this.visitType(typeNode.elementType, substitutions);
    } else if (typeNode.kind === "PointerType") {
      typeNode.pointeeType = this.visitType(typeNode.pointeeType, substitutions);
    } else if (typeNode.kind === "NullableType") {
      typeNode.innerType = this.visitType(typeNode.innerType, substitutions);
    } else if (typeNode.kind === "ResultType") {
      typeNode.okType = this.visitType(typeNode.okType, substitutions);
      typeNode.errType = this.visitType(typeNode.errType, substitutions);
    } else if (typeNode.kind === "MapType") {
      typeNode.valueType = this.visitType(typeNode.valueType, substitutions);
    }
    return typeNode;
  }

  private instantiateStruct(genericName: string, typeArgs: ast.TypeNode[]): string {
    const decl = this.genericStructs.get(genericName);
    if (!decl) {
      // If it's not a known generic struct, we might be incorrectly treating it as one, or it's undeclared.
      // We will just format its name and hope for the best (or maybe it's an error).
      return `${genericName}_${typeArgs.map(formatTypeName).join("_")}`;
    }

    if (!decl.typeParams || decl.typeParams.length !== typeArgs.length) {
      throw new Error(`Generic struct ${genericName} expects ${decl.typeParams?.length || 0} type arguments, got ${typeArgs.length}.`);
    }

    const specializedName = `${genericName}_${typeArgs.map(formatTypeName).join("_")}`;
    
    if (!this.instantiatedStructs.has(specializedName)) {
      this.instantiatedStructs.add(specializedName);
      
      // Clone and substitute
      const newDecl = this.cloneNode(decl);
      newDecl.name.name = specializedName;
      delete newDecl.typeParams;

      const subs = new Map<string, ast.TypeNode>();
      for (let i = 0; i < decl.typeParams.length; i++) {
        subs.set(decl.typeParams[i].name, typeArgs[i]);
      }

      this.specializedDecls.push(newDecl);
      // Recursively visit the new declaration in case it instantiates other generics
      this.visitDeclaration(newDecl, subs);
    }

    return specializedName;
  }

  private instantiateFunction(genericName: string, typeArgs: ast.TypeNode[]): string {
    const decl = this.genericFunctions.get(genericName);
    if (!decl) {
      return `${genericName}_${typeArgs.map(formatTypeName).join("_")}`;
    }

    if (!decl.typeParams || decl.typeParams.length !== typeArgs.length) {
      throw new Error(`Generic function ${genericName} expects ${decl.typeParams?.length || 0} type arguments, got ${typeArgs.length}.`);
    }

    const specializedName = `${genericName}_${typeArgs.map(formatTypeName).join("_")}`;
    
    if (!this.instantiatedFunctions.has(specializedName)) {
      this.instantiatedFunctions.add(specializedName);
      
      // Clone and substitute
      const newDecl = this.cloneNode(decl);
      newDecl.name.name = specializedName;
      delete newDecl.typeParams;

      const subs = new Map<string, ast.TypeNode>();
      for (let i = 0; i < decl.typeParams.length; i++) {
        subs.set(decl.typeParams[i].name, typeArgs[i]);
      }

      this.specializedDecls.push(newDecl);
      // Recursively visit the new declaration
      this.visitDeclaration(newDecl, subs);
    }

    return specializedName;
  }
}
