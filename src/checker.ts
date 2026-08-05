// ============================================================
// Vektor — Static Type Checker (Semantic Analysis)
// ============================================================
// Performs static type checking on the Abstract Syntax Tree (AST).
// Validates variable declarations, function parameters/returns,
// assignments, struct fields, and expression types.
// ============================================================

import {
  Program, Declaration, Statement, Expression, Block,
  TypeNode, PrimitiveType, ArrayType, PointerType, NullableType, ResultType, MapType,
  StructDecl, FunctionDecl, LetStatement, ConstStatement, ReturnStatement,
  IfStatement, WhileStatement, ForStatement, ForInStatement, ExpressionStatement,
  BinaryExpr, UnaryExpr, PostfixExpr, CallExpr, FieldAccessExpr, IndexAccessExpr,
  StructLiteral, CastExpr, AllocExpr, CloneExpr, ArrayLiteral, AssignmentExpr, SpawnExpr,
  Identifier
} from "./ast.js";
import { TokenType } from "./tokens.js";
import { TypeCheckError } from "./errors.js";

export interface TypeCheckResult {
  errors: TypeCheckError[];
}

export type SymbolType =
  | { kind: "primitive"; name: string }
  | { kind: "array"; elementType: SymbolType; size?: number }
  | { kind: "pointer"; pointeeType: SymbolType }
  | { kind: "nullable"; innerType: SymbolType }
  | { kind: "result"; okType: SymbolType; errType: SymbolType }
  | { kind: "map"; valueType: SymbolType }
  | { kind: "struct"; name: string }
  | { kind: "function"; paramTypes: SymbolType[]; returnType: SymbolType }
  | { kind: "void" }
  | { kind: "unknown" }
  | { kind: "any" };

class TypeEnvironment {
  private bindings: Map<string, SymbolType> = new Map();
  private parent: TypeEnvironment | null;

  constructor(parent: TypeEnvironment | null = null) {
    this.parent = parent;
  }

  define(name: string, type: SymbolType): void {
    this.bindings.set(name, type);
  }

  lookup(name: string): SymbolType | null {
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return null;
  }
}

export class TypeChecker {
  private errors: TypeCheckError[] = [];
  private globalEnv: TypeEnvironment;
  private currentEnv: TypeEnvironment;
  private structDefs: Map<string, StructDecl> = new Map();
  private currentFunctionReturn: SymbolType | null = null;

  constructor() {
    this.globalEnv = new TypeEnvironment();
    this.currentEnv = this.globalEnv;
    this.registerBuiltins();
  }

  public check(program: Program): TypeCheckResult {
    // Phase 1: Collect all struct declarations
    for (const decl of program.declarations) {
      if (decl.kind === "StructDecl") {
        this.structDefs.set(decl.name.name, decl);
      }
    }

    // Phase 2: Register top-level function & const declarations
    for (const decl of program.declarations) {
      if (decl.kind === "FunctionDecl") {
        const paramTypes = decl.params.map(p => this.astTypeToSymbolType(p.type));
        const returnType = decl.returnType ? this.astTypeToSymbolType(decl.returnType) : { kind: "void" } as SymbolType;
        this.globalEnv.define(decl.name.name, {
          kind: "function",
          paramTypes,
          returnType,
        });
      } else if (decl.kind === "ConstStatement") {
        const constType = this.astTypeToSymbolType(decl.type);
        this.globalEnv.define(decl.name.name, constType);
      }
    }

    // Phase 3: Type check all declarations
    for (const decl of program.declarations) {
      this.checkDeclaration(decl);
    }

    return { errors: this.errors };
  }

  private registerBuiltins(): void {
    const i32: SymbolType = { kind: "primitive", name: "i32" };
    const str: SymbolType = { kind: "primitive", name: "str" };
    const bool: SymbolType = { kind: "primitive", name: "bool" };
    const voidType: SymbolType = { kind: "void" };
    const anyType: SymbolType = { kind: "any" };

    const builtins = [
      "print", "println", "toString", "readLine", "read_file", "write_file", "parseFloat",
      "array_new", "array_push", "array_length", "array_push_u16", "array_push_u32",
      "array_push_i32", "array_push_f64", "array_push_str", "write_binary",
      "args_count", "args_get", "resolve_import", "mkdir", "file_exists", "list_dir",
      "shell_exec", "parse_json", "stringify_json", "system", "get_env",
      "sqrt", "pow", "sin", "cos", "abs", "floor", "ceil",
      "charAt", "indexOf", "toUpper", "toLower", "trim", "substring", "str_length", "parseI32",
      "time", "exit",
      "map_create", "map_set", "map_get", "map_has", "map_delete", "map_keys",
      "alloc", "free", "Ok", "Err"
    ];

    for (const name of builtins) {
      this.globalEnv.define(name, {
        kind: "function",
        paramTypes: [anyType, anyType, anyType, anyType],
        returnType: anyType,
      });
    }
  }

  private checkDeclaration(decl: Declaration): void {
    if (decl.kind === "FunctionDecl") {
      this.checkFunctionDecl(decl);
    } else if (decl.kind === "ConstStatement") {
      this.checkConstStatement(decl);
    }
  }

  private checkFunctionDecl(fn: FunctionDecl): void {
    const previousReturn = this.currentFunctionReturn;
    this.currentFunctionReturn = fn.returnType ? this.astTypeToSymbolType(fn.returnType) : { kind: "void" };

    const fnEnv = new TypeEnvironment(this.globalEnv);
    for (const param of fn.params) {
      fnEnv.define(param.name.name, this.astTypeToSymbolType(param.type));
    }

    const previousEnv = this.currentEnv;
    this.currentEnv = fnEnv;

    this.checkBlock(fn.body);

    this.currentEnv = previousEnv;
    this.currentFunctionReturn = previousReturn;
  }

  private checkConstStatement(stmt: ConstStatement): void {
    const declaredType = this.astTypeToSymbolType(stmt.type);
    const initType = this.checkExpression(stmt.initializer);

    if (!this.isAssignable(declaredType, initType)) {
      this.addError(stmt.line, stmt.column, `Cannot assign type '${this.typeToString(initType)}' to constant '${stmt.name.name}' of type '${this.typeToString(declaredType)}'.`);
    }
  }

  private checkStatement(stmt: Statement): void {
    switch (stmt.kind) {
      case "LetStatement":
        this.checkLetStatement(stmt);
        break;
      case "ConstStatement":
        this.checkConstStatement(stmt);
        break;
      case "ReturnStatement":
        this.checkReturnStatement(stmt);
        break;
      case "IfStatement":
        this.checkIfStatement(stmt);
        break;
      case "WhileStatement":
        this.checkWhileStatement(stmt);
        break;
      case "ForStatement":
        this.checkForStatement(stmt);
        break;
      case "ForInStatement":
        this.checkForInStatement(stmt);
        break;
      case "ExpressionStatement":
        this.checkExpression(stmt.expression);
        break;
      case "Block":
        this.checkBlock(stmt);
        break;
    }
  }

  private checkLetStatement(stmt: LetStatement): void {
    let declaredType: SymbolType | null = stmt.type ? this.astTypeToSymbolType(stmt.type) : null;
    let initType: SymbolType | null = stmt.initializer ? this.checkExpression(stmt.initializer) : null;

    if (!declaredType && !initType) {
      this.addError(stmt.line, stmt.column, `Variable '${stmt.name.name}' must have an explicit type or initializer.`);
      return;
    }

    const finalType = declaredType || initType!;

    if (declaredType && initType && !this.isAssignable(declaredType, initType)) {
      this.addError(stmt.line, stmt.column, `Cannot assign '${this.typeToString(initType)}' to variable '${stmt.name.name}' of type '${this.typeToString(declaredType)}'.`);
    }

    this.currentEnv.define(stmt.name.name, finalType);
  }

  private checkReturnStatement(stmt: ReturnStatement): void {
    const returnType = stmt.value ? this.checkExpression(stmt.value) : { kind: "void" } as SymbolType;
    if (this.currentFunctionReturn) {
      if (!this.isAssignable(this.currentFunctionReturn, returnType)) {
        this.addError(stmt.line, stmt.column, `Return statement type '${this.typeToString(returnType)}' does not match function return type '${this.typeToString(this.currentFunctionReturn)}'.`);
      }
    }
  }

  private checkIfStatement(stmt: IfStatement): void {
    const condType = this.checkExpression(stmt.condition);
    if (!this.isBoolLike(condType)) {
      this.addError(stmt.condition.line, stmt.condition.column, `If condition must be a boolean or truthy type, got '${this.typeToString(condType)}'.`);
    }
    this.checkBlock(stmt.thenBlock);
    if (stmt.elseBlock) {
      if (stmt.elseBlock.kind === "Block") {
        this.checkBlock(stmt.elseBlock);
      } else if (stmt.elseBlock.kind === "IfStatement") {
        this.checkIfStatement(stmt.elseBlock);
      }
    }
  }

  private checkWhileStatement(stmt: WhileStatement): void {
    const condType = this.checkExpression(stmt.condition);
    if (!this.isBoolLike(condType)) {
      this.addError(stmt.condition.line, stmt.condition.column, `While condition must be a boolean or truthy type, got '${this.typeToString(condType)}'.`);
    }
    this.checkBlock(stmt.body);
  }

  private checkForStatement(stmt: ForStatement): void {
    const loopEnv = new TypeEnvironment(this.currentEnv);
    const prevEnv = this.currentEnv;
    this.currentEnv = loopEnv;

    if (stmt.init) {
      if (stmt.init.kind === "LetStatement") this.checkLetStatement(stmt.init);
      else this.checkExpression(stmt.init.expression);
    }
    if (stmt.condition) {
      const condType = this.checkExpression(stmt.condition);
      if (!this.isBoolLike(condType)) {
        this.addError(stmt.condition.line, stmt.condition.column, `For loop condition must be a boolean, got '${this.typeToString(condType)}'.`);
      }
    }
    if (stmt.update) {
      this.checkExpression(stmt.update);
    }

    this.checkBlock(stmt.body);
    this.currentEnv = prevEnv;
  }

  private checkForInStatement(stmt: ForInStatement): void {
    const startType = this.checkExpression(stmt.start);
    const endType = this.checkExpression(stmt.end);

    const i32: SymbolType = { kind: "primitive", name: "i32" };
    if (!this.isAssignable(i32, startType) || !this.isAssignable(i32, endType)) {
      this.addError(stmt.line, stmt.column, `For-in range bounds must be integer types.`);
    }

    const loopEnv = new TypeEnvironment(this.currentEnv);
    loopEnv.define(stmt.variable.name, i32);

    const prevEnv = this.currentEnv;
    this.currentEnv = loopEnv;
    this.checkBlock(stmt.body);
    this.currentEnv = prevEnv;
  }

  private checkBlock(block: Block): void {
    const blockEnv = new TypeEnvironment(this.currentEnv);
    const prevEnv = this.currentEnv;
    this.currentEnv = blockEnv;

    for (const stmt of block.statements) {
      this.checkStatement(stmt);
    }

    this.currentEnv = prevEnv;
  }

  private checkExpression(expr: Expression): SymbolType {
    switch (expr.kind) {
      case "IntegerLiteral":
        return { kind: "primitive", name: "i32" };
      case "FloatLiteral":
        return { kind: "primitive", name: "f64" };
      case "StringLiteral":
        return { kind: "primitive", name: "str" };
      case "CharLiteral":
        return { kind: "primitive", name: "byte" };
      case "BooleanLiteral":
        return { kind: "primitive", name: "bool" };
      case "NullLiteral":
        return { kind: "nullable", innerType: { kind: "any" } };
      case "Identifier":
        return this.checkIdentifier(expr);
      case "BinaryExpr":
        return this.checkBinaryExpr(expr);
      case "UnaryExpr":
        return this.checkUnaryExpr(expr);
      case "PostfixExpr":
        return this.checkPostfixExpr(expr);
      case "CallExpr":
        return this.checkCallExpr(expr);
      case "FieldAccessExpr":
        return this.checkFieldAccessExpr(expr);
      case "IndexAccessExpr":
        return this.checkIndexAccessExpr(expr);
      case "StructLiteral":
        return this.checkStructLiteral(expr);
      case "CastExpr":
        return this.checkCastExpr(expr);
      case "AllocExpr":
        return this.checkAllocExpr(expr);
      case "CloneExpr":
        return this.checkExpression(expr.expr);
      case "ArrayLiteral":
        return this.checkArrayLiteral(expr);
      case "AssignmentExpr":
        return this.checkAssignmentExpr(expr);
      case "SpawnExpr":
        return this.checkExpression(expr.call);
      default:
        return { kind: "unknown" };
    }
  }

  private checkIdentifier(ident: Identifier): SymbolType {
    const symbol = this.currentEnv.lookup(ident.name);
    if (!symbol) {
      this.addError(ident.line, ident.column, `Undefined identifier '${ident.name}'.`);
      return { kind: "unknown" };
    }
    return symbol;
  }

  private checkBinaryExpr(expr: BinaryExpr): SymbolType {
    const leftType = this.checkExpression(expr.left);
    const rightType = this.checkExpression(expr.right);
    const op = expr.operator.lexeme;

    if (op === "+" || op === "-" || op === "*" || op === "/" || op === "%") {
      if (op === "+" && (this.isString(leftType) || this.isString(rightType))) {
        return { kind: "primitive", name: "str" };
      }
      if (this.isNumeric(leftType) && this.isNumeric(rightType)) {
        return leftType;
      }
      this.addError(expr.line, expr.column, `Operator '${op}' cannot be applied to types '${this.typeToString(leftType)}' and '${this.typeToString(rightType)}'.`);
      return { kind: "unknown" };
    }

    if (op === "==" || op === "!=" || op === "<" || op === ">" || op === "<=" || op === ">=") {
      return { kind: "primitive", name: "bool" };
    }

    if (op === "&&" || op === "||" || op === "and" || op === "or") {
      return { kind: "primitive", name: "bool" };
    }

    return { kind: "unknown" };
  }

  private checkUnaryExpr(expr: UnaryExpr): SymbolType {
    const operandType = this.checkExpression(expr.operand);
    const op = expr.operator.lexeme;

    if (op === "!" || op === "not") {
      return { kind: "primitive", name: "bool" };
    }
    if (op === "-") {
      if (this.isNumeric(operandType)) return operandType;
      this.addError(expr.line, expr.column, `Unary minus cannot be applied to type '${this.typeToString(operandType)}'.`);
      return { kind: "unknown" };
    }
    if (op === "&") {
      return { kind: "pointer", pointeeType: operandType };
    }
    if (op === "*") {
      if (operandType.kind === "pointer") {
        return operandType.pointeeType;
      }
      this.addError(expr.line, expr.column, `Cannot dereference non-pointer type '${this.typeToString(operandType)}'.`);
      return { kind: "unknown" };
    }

    return { kind: "unknown" };
  }

  private checkPostfixExpr(expr: PostfixExpr): SymbolType {
    const operandType = this.checkExpression(expr.operand);
    if (!this.isNumeric(operandType)) {
      this.addError(expr.line, expr.column, `Postfix operator '${expr.operator.lexeme}' requires a numeric variable.`);
    }
    return operandType;
  }

  private checkCallExpr(expr: CallExpr): SymbolType {
    const calleeType = this.checkExpression(expr.callee);

    if (calleeType.kind === "any") {
      return { kind: "any" };
    }

    if (calleeType.kind !== "function") {
      this.addError(expr.line, expr.column, `Attempted to call non-function of type '${this.typeToString(calleeType)}'.`);
      return { kind: "unknown" };
    }

    const argTypes = expr.args.map(a => this.checkExpression(a));
    const isVariadicAny = calleeType.paramTypes.length > 0 && calleeType.paramTypes[0].kind === "any";

    if (!isVariadicAny && calleeType.paramTypes.length !== argTypes.length) {
      this.addError(expr.line, expr.column, `Expected ${calleeType.paramTypes.length} arguments but got ${argTypes.length}.`);
    } else if (!isVariadicAny) {
      for (let i = 0; i < argTypes.length; i++) {
        const expected = calleeType.paramTypes[i];
        const actual = argTypes[i];
        if (!this.isAssignable(expected, actual)) {
          this.addError(expr.args[i].line, expr.args[i].column, `Argument ${i + 1} type '${this.typeToString(actual)}' does not match expected parameter type '${this.typeToString(expected)}'.`);
        }
      }
    }

    return calleeType.returnType;
  }

  private checkFieldAccessExpr(expr: FieldAccessExpr): SymbolType {
    const objType = this.checkExpression(expr.object);

    if (objType.kind === "struct") {
      const decl = this.structDefs.get(objType.name);
      if (!decl) {
        this.addError(expr.line, expr.column, `Unknown struct '${objType.name}'.`);
        return { kind: "unknown" };
      }
      const field = decl.fields.find(f => f.name.name === expr.field.name);
      if (!field) {
        this.addError(expr.line, expr.column, `Struct '${objType.name}' has no field '${expr.field.name}'.`);
        return { kind: "unknown" };
      }
      return this.astTypeToSymbolType(field.type);
    }

    if (objType.kind === "array" || (objType.kind === "primitive" && objType.name === "str")) {
      if (expr.field.name === "len") {
        return { kind: "primitive", name: "i32" };
      }
      if (expr.field.name === "bytes" && objType.name === "str") {
        return { kind: "array", elementType: { kind: "primitive", name: "byte" } };
      }
    }

    if (objType.kind === "result") {
      if (expr.field.name === "ok") return { kind: "primitive", name: "bool" };
      if (expr.field.name === "value") return objType.okType;
      if (expr.field.name === "error") return objType.errType;
    }

    this.addError(expr.line, expr.column, `Cannot access field '${expr.field.name}' on type '${this.typeToString(objType)}'.`);
    return { kind: "unknown" };
  }

  private checkIndexAccessExpr(expr: IndexAccessExpr): SymbolType {
    const objType = this.checkExpression(expr.object);
    const indexType = this.checkExpression(expr.index);

    if (!this.isNumeric(indexType)) {
      this.addError(expr.index.line, expr.index.column, `Index must be an integer, got '${this.typeToString(indexType)}'.`);
    }

    if (objType.kind === "array") {
      return objType.elementType;
    }
    if (objType.kind === "pointer") {
      return objType.pointeeType;
    }

    this.addError(expr.line, expr.column, `Cannot index non-array/non-pointer type '${this.typeToString(objType)}'.`);
    return { kind: "unknown" };
  }

  private checkStructLiteral(expr: StructLiteral): SymbolType {
    const decl = this.structDefs.get(expr.name);
    if (!decl) {
      this.addError(expr.line, expr.column, `Unknown struct '${expr.name}'.`);
      return { kind: "unknown" };
    }

    for (const field of expr.fields) {
      const fieldDecl = decl.fields.find(f => f.name.name === field.name.name);
      const fieldValType = this.checkExpression(field.value);
      if (!fieldDecl) {
        this.addError(field.line, field.column, `Field '${field.name.name}' does not exist on struct '${expr.name}'.`);
      } else {
        const expectedType = this.astTypeToSymbolType(fieldDecl.type);
        if (!this.isAssignable(expectedType, fieldValType)) {
          this.addError(field.line, field.column, `Field '${field.name.name}' expected type '${this.typeToString(expectedType)}', got '${this.typeToString(fieldValType)}'.`);
        }
      }
    }

    return { kind: "struct", name: expr.name };
  }

  private checkCastExpr(expr: CastExpr): SymbolType {
    this.checkExpression(expr.expr);
    return this.astTypeToSymbolType(expr.targetType);
  }

  private checkAllocExpr(expr: AllocExpr): SymbolType {
    const sizeType = this.checkExpression(expr.sizeExpr);
    if (!this.isNumeric(sizeType)) {
      this.addError(expr.line, expr.column, `Alloc size must be an integer, got '${this.typeToString(sizeType)}'.`);
    }
    return { kind: "pointer", pointeeType: { kind: "primitive", name: "byte" } };
  }

  private checkArrayLiteral(expr: ArrayLiteral): SymbolType {
    if (expr.elements.length === 0) {
      return { kind: "array", elementType: { kind: "any" } };
    }
    const elemType = this.checkExpression(expr.elements[0]);
    for (let i = 1; i < expr.elements.length; i++) {
      const current = this.checkExpression(expr.elements[i]);
      if (!this.isAssignable(elemType, current)) {
        this.addError(expr.elements[i].line, expr.elements[i].column, `Array element type mismatch: expected '${this.typeToString(elemType)}', got '${this.typeToString(current)}'.`);
      }
    }
    return { kind: "array", elementType: elemType, size: expr.elements.length };
  }

  private checkAssignmentExpr(expr: AssignmentExpr): SymbolType {
    const targetType = this.checkExpression(expr.target);
    const valueType = this.checkExpression(expr.value);

    if (!this.isAssignable(targetType, valueType)) {
      this.addError(expr.line, expr.column, `Cannot assign '${this.typeToString(valueType)}' to target of type '${this.typeToString(targetType)}'.`);
    }
    return valueType;
  }

  // ── Helper Utilities ─────────────────────────────────────

  private astTypeToSymbolType(t: TypeNode): SymbolType {
    switch (t.kind) {
      case "PrimitiveType":
        if (this.structDefs.has(t.name)) return { kind: "struct", name: t.name };
        return { kind: "primitive", name: t.name };
      case "ArrayType":
        return { kind: "array", elementType: this.astTypeToSymbolType(t.elementType), size: t.size };
      case "PointerType":
        return { kind: "pointer", pointeeType: this.astTypeToSymbolType(t.pointeeType) };
      case "NullableType":
        return { kind: "nullable", innerType: this.astTypeToSymbolType(t.innerType) };
      case "ResultType":
        return { kind: "result", okType: this.astTypeToSymbolType(t.okType), errType: this.astTypeToSymbolType(t.errType) };
      case "MapType":
        return { kind: "map", valueType: this.astTypeToSymbolType(t.valueType) };
      default:
        return { kind: "unknown" };
    }
  }

  private isAssignable(expected: SymbolType, actual: SymbolType): boolean {
    if (expected.kind === "any" || actual.kind === "any") return true;
    if (expected.kind === "unknown" || actual.kind === "unknown") return true;
    if (expected.kind === "nullable" && actual.kind === "nullable") return true;
    if (expected.kind === "nullable" && actual.kind !== "nullable") {
      return this.isAssignable(expected.innerType, actual);
    }
    if (expected.kind === "primitive" && actual.kind === "primitive") {
      if (expected.name === actual.name) return true;
      if (this.isNumeric(expected) && this.isNumeric(actual)) return true; // Loose numeric implicit coercions
      return false;
    }
    if (expected.kind === "struct" && actual.kind === "struct") {
      return expected.name === actual.name;
    }
    if (expected.kind === "array" && actual.kind === "array") {
      return this.isAssignable(expected.elementType, actual.elementType);
    }
    if (expected.kind === "pointer" && actual.kind === "pointer") {
      return this.isAssignable(expected.pointeeType, actual.pointeeType);
    }
    return false;
  }

  private isNumeric(type: SymbolType): boolean {
    if (type.kind === "any") return true;
    if (type.kind !== "primitive") return false;
    return ["i8", "i16", "i32", "i64", "f32", "f64", "byte"].includes(type.name);
  }

  private isString(type: SymbolType): boolean {
    return type.kind === "primitive" && type.name === "str";
  }

  private isBoolLike(type: SymbolType): boolean {
    if (type.kind === "any") return true;
    if (type.kind === "primitive") {
      return type.name === "bool" || this.isNumeric(type);
    }
    return type.kind === "pointer" || type.kind === "nullable";
  }

  private typeToString(type: SymbolType): string {
    switch (type.kind) {
      case "primitive": return type.name;
      case "struct": return type.name;
      case "array": return `${this.typeToString(type.elementType)}[]`;
      case "pointer": return `ptr<${this.typeToString(type.pointeeType)}>`;
      case "nullable": return `${this.typeToString(type.innerType)}?`;
      case "result": return `Result<${this.typeToString(type.okType)}, ${this.typeToString(type.errType)}>`;
      case "map": return `map<${this.typeToString(type.valueType)}>`;
      case "function": return `fn(...)`;
      case "void": return "void";
      case "any": return "any";
      case "unknown": return "unknown";
    }
  }

  private addError(line: number, column: number, message: string): void {
    this.errors.push(new TypeCheckError(line, column, message));
  }
}
