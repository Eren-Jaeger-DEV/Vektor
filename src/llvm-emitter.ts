// src/llvm-emitter.ts
// Phase 8 — Vektor -> LLVM IR

import {
  Program, FunctionDecl, StructDecl, Statement, Expression, TypeNode, PrimitiveType, ArrayType, PointerType, CallExpr
} from "./ast.js";

// ---------- 1. Type mapping ----------

export function vksTypeToLLVM(t: TypeNode): string {
  switch (t.kind) {
    case "PrimitiveType": {
      const pt = t as PrimitiveType;
      switch (pt.name) {
        case "i8": case "byte": return "i8";
        case "i16": return "i16";
        case "i32": return "i32";
        case "i64": return "i64";
        case "f32": return "float";
        case "f64": return "double";
        case "bool": return "i1";
        case "void": return "void";
        case "str": return "%str"; // builtin string struct
        default:
          return `%${pt.name}*`; // Struct type
      }
    }
    case "PointerType": {
      const pt = t as PointerType;
      return `${vksTypeToLLVM(pt.pointeeType)}*`;
    }
    case "ArrayType": {
      const pt = t as ArrayType;
      if (pt.size !== undefined) {
        return `[${pt.size} x ${vksTypeToLLVM(pt.elementType)}]`;
      } else {
        // Dynamic array struct
        return `%array_${vksTypeToLLVM(pt.elementType).replace(/[%*]/g, "")}`;
      }
    }
    case "NullableType": {
      const nt = t as any;
      return `${vksTypeToLLVM(nt.innerType)}*`;
    }
    case "MapType":
      return "i8*"; // Unimplemented complex types
    case "ResultType": {
      const rt = t as ResultType;
      const okType = vksTypeToLLVM(rt.okType).replace(/[%*]/g, "");
      const errType = vksTypeToLLVM(rt.errType).replace(/[%*]/g, "");
      return `%Result_${okType}_${errType}`;
    }
    default:
      return "i32";
  }
}

export function llvmTypeSize(llvmType: string): number {
    switch (llvmType) {
        case "i8": return 1;
        case "i16": return 2;
        case "i32": case "float": return 4;
        case "i64": case "double": case "%str": return 8;
        case "i1": return 1;
        default:
            if (llvmType.endsWith("*")) return 8;
            return 8; // Default conservative size
    }
}

// ---------- Scope for Type Lookups ----------

class Scope {
  locals: Map<string, string> = new Map(); // name -> LLVM type
  parent: Scope | null = null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  define(name: string, type: string) {
    this.locals.set(name, type);
  }

  resolve(name: string): string | null {
    if (this.locals.has(name)) return this.locals.get(name)!;
    if (this.parent) return this.parent.resolve(name);
    return null;
  }
}

// ---------- 2. Emitter ----------

export class LLVMEmitter {
  private out: string[] = [];
  private tempCount = 0;
  private blockCount = 0;
  private structTypes = new Map<string, string>(); // name -> %Name = type {...}
  private structFields = new Map<string, { name: string; type: string }[]>(); // struct layout
  private functionReturns = new Map<string, string>(); // fn_name -> LLVM return type

  private scope: Scope = new Scope();

  private usedArrayTypes = new Set<string>(); // Element types like "i32", "float"
  private usedResultTypes = new Set<string>(); // "{okType}_{errType}"
  private stringLiterals = new Map<string, string>(); // content -> @str.N
  private trampolines: string[] = [];
  private targetTriple: string;

  constructor(targetTriple: string = "x86_64-w64-mingw32") {
    this.targetTriple = targetTriple;
  }

  private pushScope() {
    this.scope = new Scope(this.scope);
  }

  private popScope() {
    if (this.scope.parent) {
      this.scope = this.scope.parent;
    }
  }

  private collectDynamicTypes(node: any) {
    if (!node || typeof node !== "object") return;
    if (node.kind === "ArrayType" && node.size === undefined) {
      this.usedArrayTypes.add(vksTypeToLLVM(node.elementType));
    } else if (node.kind === "ResultType") {
      const okType = vksTypeToLLVM(node.okType);
      const errType = vksTypeToLLVM(node.errType);
      this.usedResultTypes.add(`${okType}|${errType}`);
    } else if (node.kind === "StringLiteral") {
      if (!this.stringLiterals.has(node.value)) {
        this.stringLiterals.set(node.value, `@.str.${this.stringLiterals.size}`);
      }
    }
    for (const key of Object.keys(node)) {
      if (Array.isArray(node[key])) {
        for (const child of node[key]) this.collectDynamicTypes(child);
      } else if (typeof node[key] === "object") {
        this.collectDynamicTypes(node[key]);
      }
    }
  }

  private resolveField(structName: string, fieldName: string) {
    const fields = this.structFields.get(structName);
    if (!fields) throw new Error(`Struct not found: ${structName}`);
    const index = fields.findIndex(f => f.name === fieldName);
    if (index === -1) throw new Error(`Field ${fieldName} not found in struct ${structName}`);
    return { index, type: fields[index].type };
  }

  private lookupStructName(exprType: string): string {
    const match = exprType.match(/^%([^]+?)\*?$/);
    if (match) return match[1];
    return exprType;
  }

  private fresh(prefix = "t"): string {
    return `%${prefix}${this.tempCount++}`;
  }

  private freshBlock(prefix = "bb"): string {
    return `${prefix}${this.blockCount++}`;
  }

  private emitStructDecl(decl: StructDecl) {
    this.structFields.set(decl.name.name, decl.fields.map(f => ({
      name: f.name.name,
      type: vksTypeToLLVM(f.type)
    })));
    const fields = decl.fields.map(f => vksTypeToLLVM(f.type)).join(", ");
    this.out.push(`%${decl.name.name} = type { ${fields} }`);
  }

  emit(program: Program): string {
    this.out = [];
    this.out.push(`; ModuleID = 'vektor'`);
    this.out.push(`source_filename = "main.vk"`);
    this.out.push(`target datalayout = "e-m:w-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128"`);
    this.out.push(`target triple = "${this.targetTriple}"`);
    this.out.push(``);
    this.out.push(`%str = type { i8*, i64 }`);
    this.structFields.set("str", [
      { name: "data", type: "i8*" },
      { name: "len", type: "i64" }
    ]);
    this.out.push("");

    // Extern declarations
    this.out.push(`declare i8* @malloc(i64)`);
    this.out.push(`declare void @free(i8*)`);
    this.out.push(`declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)`);
    this.out.push(`declare void @vk_print_i32(i32)`);
    this.out.push(`declare void @vk_print_f64(double)`);
    this.out.push(`declare void @vk_print_str(i8*, i64)`);
    this.out.push(`declare void @vk_print_bool(i32)`);
    this.out.push(`declare double @vk_sqrt(double)`);
    this.out.push(`declare void @vk_push_frame(i8*)`);
    this.out.push(`declare void @vk_pop_frame()`);
    this.out.push(`declare void @vks_panic(i8*)`);
    this.out.push(`declare i8* @vks_spawn(i8*, i8*)`);
    this.out.push(`declare void @vks_thread_join(i8*)`);
    this.out.push(`declare i8* @vks_mutex_create()`);
    this.out.push(`declare void @vks_mutex_lock(i8*)`);
    this.out.push(`declare void @vks_mutex_unlock(i8*)`);
    this.out.push(`declare void @vks_mutex_destroy(i8*)`);
    this.out.push("");

    // Pass 1: Global declarations & Dynamic types
    this.collectDynamicTypes(program);
    for (const elemType of this.usedArrayTypes) {
      const structName = `%array_${elemType.replace(/[%*]/g, "")}`;
      this.out.push(`${structName} = type { i32, i32, ${elemType}* }`);
      this.structFields.set(structName.substring(1), [
        { name: "length", type: "i32" },
        { name: "capacity", type: "i32" },
        { name: "data", type: `${elemType}*` }
      ]);
    }
    
    for (const resTypeStr of this.usedResultTypes) {
      const [okType, errType] = resTypeStr.split("|");
      const okClean = okType.replace(/[%*]/g, "");
      const errClean = errType.replace(/[%*]/g, "");
      const structName = `%Result_${okClean}_${errClean}`;
      this.out.push(`${structName} = type { i1, ${okType}, ${errType} }`);
      this.structFields.set(structName.substring(1), [
        { name: "ok", type: "i1" },
        { name: "value", type: okType },
        { name: "error", type: errType }
      ]);
    }
    this.out.push("");
    
    // String builtins and Networking builtins (now placed after structs are defined)
    this.out.push(`declare %array_str @vks_get_args()`);
    this.out.push(`declare %str* @vks_get_env(%str)`);
    this.out.push(`declare %array_str* @vks_str_split(i8*, i64, i8*, i64)`);
    this.out.push(`declare %str @vks_str_replace(%str, %str, %str)`);
    this.out.push(`declare void @vk_free_str_array(%array_str)`);
    this.out.push(`declare i8* @vks_tcp_connect(i8*, i64, i32)`);
    this.out.push(`declare i32 @vks_socket_send(i8*, i8*, i64)`);
    this.out.push(`declare %str* @vks_socket_recv_all(i8*)`);
    this.out.push(`declare void @vks_socket_close(i8*)`);
    this.out.push("");
    
    // Ensure all function names are in string literals for stack traces
    for (const decl of program.declarations) {
      if (decl.kind === "FunctionDecl") {
        const name = (decl as FunctionDecl).name.name;
        if (!this.stringLiterals.has(name)) {
          this.stringLiterals.set(name, `@.str.${this.stringLiterals.size}`);
        }
      }
    }

    // String literals
    for (const [val, name] of this.stringLiterals.entries()) {
      // Escape for LLVM, e.g. add \00
      let escaped = val.replace(/\\/g, "\\\\").replace(/"/g, "\\22").replace(/\n/g, "\\0A");
      this.out.push(`${name} = private unnamed_addr constant [${val.length + 1} x i8] c"${escaped}\\00", align 1`);
    }
    this.out.push("");

    for (const decl of program.declarations) {
      if (decl.kind === "StructDecl") {
        this.emitStructDecl(decl as StructDecl);
      } else if (decl.kind === "FunctionDecl") {
        const fn = decl as FunctionDecl;
        const retType = fn.returnType ? vksTypeToLLVM(fn.returnType) : "void";
        this.functionReturns.set(fn.name.name, retType);
      }
    }

    this.out.push("");

    // Pass 2: Actually emit all functions
    for (const decl of program.declarations) {
      if (decl.kind === "FunctionDecl") {
        this.emitFunction(decl as FunctionDecl);
      }
    }

    this.out.push(...this.trampolines);

    return this.out.join("\n");
  }


  private emitFunction(fn: FunctionDecl) {
    this.pushScope();
    this.tempCount = 0;
    this.blockCount = 0;

    const retType = fn.returnType ? vksTypeToLLVM(fn.returnType) : "void";
    const params = fn.params
      .map(p => {
        const llvmType = vksTypeToLLVM(p.type);
        this.scope.define(p.name.name, llvmType);
        return `${llvmType} %${p.name.name}.arg`;
      })
      .join(", ");

    const actualName = fn.name.name === "main" ? "vks_main" : fn.name.name;
    this.out.push(`define ${retType} @${actualName}(${params}) {`);
    this.out.push(`entry:`);

    const fnNameStr = fn.name.name;
    const globalName = this.stringLiterals.get(fnNameStr);
    const escapedLen = fnNameStr.length + 1;
    this.out.push(`  call void @vk_push_frame(i8* getelementptr inbounds ([${escapedLen} x i8], [${escapedLen} x i8]* ${globalName}, i64 0, i64 0))`);

    // Allocate stack slots for params
    for (const p of fn.params) {
      const llvmType = vksTypeToLLVM(p.type);
      this.out.push(`  %${p.name.name} = alloca ${llvmType}`);
      this.out.push(`  store ${llvmType} %${p.name.name}.arg, ${llvmType}* %${p.name.name}`);
    }

    // Body
    for (const stmt of fn.body.statements) {
      this.emitStmt(stmt);
    }

    // Safety net
    this.out.push(`  call void @vk_pop_frame()`);
    if (retType === "void") {
      this.out.push(`  ret void`);
    } else {
      this.out.push(`  ret ${retType} zeroinitializer`);
    }

    this.out.push(`}`);
    this.out.push("");
    
    this.popScope();
  }

  private emitStmt(stmt: Statement) {
    switch (stmt.kind) {
      case "ReturnStatement": {
        this.out.push(`  call void @vk_pop_frame()`);
        if (!stmt.value) {
          this.out.push(`  ret void`);
          return;
        }
        const { reg, type } = this.emitExpr(stmt.value);
        this.out.push(`  ret ${type} ${reg}`);
        return;
      }

      case "LetStatement": {
        if (!stmt.type) throw new Error("LLVM requires explicit types for LetStatements currently");
        const llvmType = vksTypeToLLVM(stmt.type);
        this.scope.define(stmt.name.name, llvmType);

        this.out.push(`  %${stmt.name.name} = alloca ${llvmType}`);
        if (stmt.initializer) {
          const { reg, type: initType } = this.emitExpr(stmt.initializer, llvmType);
          this.out.push(`  store ${initType} ${reg}, ${llvmType}* %${stmt.name.name}`);
        }
        return;
      }

      case "ConstStatement": {
        const llvmType = vksTypeToLLVM(stmt.type);
        this.scope.define(stmt.name.name, llvmType);
        this.out.push(`  %${stmt.name.name} = alloca ${llvmType}`);
        const { reg, type: initType } = this.emitExpr(stmt.initializer, llvmType);
        this.out.push(`  store ${initType} ${reg}, ${llvmType}* %${stmt.name.name}`);
        return;
      }

      case "IfStatement": {
        const { reg: condReg } = this.emitExpr(stmt.condition);
        const thenLabel = this.freshBlock("then");
        const elseLabel = this.freshBlock("else");
        const endLabel = this.freshBlock("endif");

        this.out.push(`  br i1 ${condReg}, label %${thenLabel}, label %${elseLabel}`);
        
        this.out.push(`${thenLabel}:`);
        this.pushScope();
        for (const s of stmt.thenBlock.statements) this.emitStmt(s);
        this.popScope();
        this.out.push(`  br label %${endLabel}`);

        this.out.push(`${elseLabel}:`);
        if (stmt.elseBlock) {
          this.pushScope();
          if (stmt.elseBlock.kind === "Block") {
            for (const s of stmt.elseBlock.statements) this.emitStmt(s);
          } else {
            this.emitStmt(stmt.elseBlock);
          }
          this.popScope();
        }
        this.out.push(`  br label %${endLabel}`);

        this.out.push(`${endLabel}:`);
        return;
      }

      case "WhileStatement": {
        const condLabel = this.freshBlock("whilecond");
        const bodyLabel = this.freshBlock("whilebody");
        const endLabel = this.freshBlock("whileend");

        this.out.push(`  br label %${condLabel}`);
        
        this.out.push(`${condLabel}:`);
        const { reg: condReg } = this.emitExpr(stmt.condition);
        this.out.push(`  br i1 ${condReg}, label %${bodyLabel}, label %${endLabel}`);

        this.out.push(`${bodyLabel}:`);
        this.pushScope();
        for (const s of stmt.body.statements) this.emitStmt(s);
        this.popScope();
        this.out.push(`  br label %${condLabel}`);

        this.out.push(`${endLabel}:`);
        return;
      }

      case "ForStatement": {
        this.pushScope();
        
        // 1. Init
        if (stmt.init) {
          this.emitStmt(stmt.init);
        }
        
        const condLabel = this.freshBlock("forcond");
        const bodyLabel = this.freshBlock("forbody");
        const endLabel = this.freshBlock("forend");

        this.out.push(`  br label %${condLabel}`);
        
        // 2. Condition
        this.out.push(`${condLabel}:`);
        if (stmt.condition) {
          const { reg: condReg } = this.emitExpr(stmt.condition);
          this.out.push(`  br i1 ${condReg}, label %${bodyLabel}, label %${endLabel}`);
        } else {
          // If no condition, it's an infinite loop
          this.out.push(`  br label %${bodyLabel}`);
        }

        // 3. Body
        this.out.push(`${bodyLabel}:`);
        for (const s of stmt.body.statements) this.emitStmt(s);
        
        // 4. Update
        if (stmt.update) {
          this.emitExpr(stmt.update);
        }
        this.out.push(`  br label %${condLabel}`);

        // 5. End
        this.out.push(`${endLabel}:`);
        
        this.popScope();
        return;
      }

      case "ExpressionStatement": {
        this.emitExpr(stmt.expression);
        return;
      }
      
      case "Block": {
        this.pushScope();
        for (const s of stmt.statements) this.emitStmt(s);
        this.popScope();
        return;
      }

      default:
        this.out.push(`  ; TODO: unhandled stmt kind ${stmt.kind}`);
    }
  }

  private emitLValue(expr: Expression): { reg: string, type: string } {
    switch (expr.kind) {
      case "Identifier": {
        const varName = expr.name;
        const llvmType = this.scope.resolve(varName) || "i32";
        return { reg: `%${varName}`, type: `${llvmType}*` };
      }
      case "UnaryExpr": {
        if (expr.operator.lexeme === "*") {
          return this.emitExpr(expr.operand); // Evaluates to a pointer
        }
        throw new Error(`Invalid L-value UnaryExpr with operator ${expr.operator.lexeme}`);
      }
      case "FieldAccessExpr": {
        const lval = this.emitLValue(expr.object);
        const structName = this.lookupStructName(lval.type.slice(0, -1)); // remove *
        const { index, type } = this.resolveField(structName, expr.field.name);
        const fieldPtr = this.fresh();
        this.out.push(`  ${fieldPtr} = getelementptr inbounds %${structName}, %${structName}* ${lval.reg}, i32 0, i32 ${index}`);
        return { reg: fieldPtr, type: `${type}*` };
      }
      case "IndexAccessExpr": {
        const lval = this.emitLValue(expr.object);
        const structName = this.lookupStructName(lval.type.slice(0, -1));
        let elemType = structName.replace("array_", "");
        if (!["i8","i16","i32","i64","float","double","i1"].includes(elemType)) elemType = "%" + elemType;
        
        const datafPtr = this.fresh();
        this.out.push(`  ${datafPtr} = getelementptr inbounds %${structName}, %${structName}* ${lval.reg}, i32 0, i32 2`);
        const data = this.fresh();
        this.out.push(`  ${data} = load ${elemType}*, ${elemType}** ${datafPtr}`);
        
        const indexExpr = this.emitExpr(expr.index);
        const elemPtr = this.fresh();
        this.out.push(`  ${elemPtr} = getelementptr inbounds ${elemType}, ${elemType}* ${data}, i32 ${indexExpr.reg}`);
        return { reg: elemPtr, type: `${elemType}*` };
      }
      case "CallExpr": {
        return this.emitExpr(expr);
      }
      default:
        throw new Error(`Invalid L-value expression: ${expr.kind}`);
    }
  }

  private emitExpr(expr: Expression, expectedType?: string): { reg: string; type: string } {
    switch (expr.kind) {
      case "IntegerLiteral":
        return { reg: `${expr.value}`, type: "i32" };

      case "FloatLiteral":
        return { reg: `${expr.value}`, type: "double" };

      case "StringLiteral": {
        const val = expr.value;
        const globalName = this.stringLiterals.get(val);
        if (!globalName) throw new Error("StringLiteral missing from pass 1: " + val);
        
        const reg = this.fresh("str");
        this.out.push(`  ${reg} = alloca %str`);
        
        const ptrPtr = this.fresh();
        this.out.push(`  ${ptrPtr} = getelementptr inbounds %str, %str* ${reg}, i32 0, i32 0`);
        const globalPtr = this.fresh();
        this.out.push(`  ${globalPtr} = getelementptr inbounds [${val.length + 1} x i8], [${val.length + 1} x i8]* ${globalName}, i32 0, i32 0`);
        this.out.push(`  store i8* ${globalPtr}, i8** ${ptrPtr}`);
        
        const lenPtr = this.fresh();
        this.out.push(`  ${lenPtr} = getelementptr inbounds %str, %str* ${reg}, i32 0, i32 1`);
        this.out.push(`  store i64 ${val.length}, i64* ${lenPtr}`);
        
        const loaded = this.fresh();
        this.out.push(`  ${loaded} = load %str, %str* ${reg}`);
        return { reg: loaded, type: "%str" };
      }

      case "BooleanLiteral":
        return { reg: expr.value ? "1" : "0", type: "i1" };

      case "Identifier": {
        const lval = this.emitLValue(expr);
        const valType = lval.type.slice(0, -1);
        const reg = this.fresh();
        this.out.push(`  ${reg} = load ${valType}, ${lval.type} ${lval.reg}`);
        return { reg, type: valType };
      }

      case "BinaryExpr": {
        const left = this.emitExpr(expr.left);
        const right = this.emitExpr(expr.right);
        const reg = this.fresh();
        
        if (left.type === "%str" && right.type === "%str" && expr.operator.lexeme === "+") {
            const lPtr = this.fresh();
            this.out.push(`  ${lPtr} = extractvalue %str ${left.reg}, 0`);
            const lLen = this.fresh();
            this.out.push(`  ${lLen} = extractvalue %str ${left.reg}, 1`);
            
            const rPtr = this.fresh();
            this.out.push(`  ${rPtr} = extractvalue %str ${right.reg}, 0`);
            const rLen = this.fresh();
            this.out.push(`  ${rLen} = extractvalue %str ${right.reg}, 1`);
            
            const newLen = this.fresh();
            this.out.push(`  ${newLen} = add i64 ${lLen}, ${rLen}`);
            
            const newPtr = this.fresh();
            this.out.push(`  ${newPtr} = call i8* @malloc(i64 ${newLen})`);
            
            this.out.push(`  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 1 ${newPtr}, i8* align 1 ${lPtr}, i64 ${lLen}, i1 false)`);
            
            const offsetPtr = this.fresh();
            this.out.push(`  ${offsetPtr} = getelementptr inbounds i8, i8* ${newPtr}, i64 ${lLen}`);
            this.out.push(`  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 1 ${offsetPtr}, i8* align 1 ${rPtr}, i64 ${rLen}, i1 false)`);
            
            const newStr = this.fresh("str");
            this.out.push(`  ${newStr} = alloca %str`);
            
            const newPtrPtr = this.fresh();
            this.out.push(`  ${newPtrPtr} = getelementptr inbounds %str, %str* ${newStr}, i32 0, i32 0`);
            this.out.push(`  store i8* ${newPtr}, i8** ${newPtrPtr}`);
            
            const newLenPtr2 = this.fresh();
            this.out.push(`  ${newLenPtr2} = getelementptr inbounds %str, %str* ${newStr}, i32 0, i32 1`);
            this.out.push(`  store i64 ${newLen}, i64* ${newLenPtr2}`);
            
            const loaded = this.fresh();
            this.out.push(`  ${loaded} = load %str, %str* ${newStr}`);
            return { reg: loaded, type: "%str" };
        }
        
        const op = this.binaryOp(expr.operator.lexeme, left.type);
        this.out.push(`  ${reg} = ${op} ${left.type} ${left.reg}, ${right.reg}`);
        const resultType = ["==","!=","<",">","<=",">="].includes(expr.operator.lexeme)
          ? "i1" : left.type;
        return { reg, type: resultType };
      }

      case "CallExpr": {
        let calleeName = "unknown";
        if (expr.callee.kind === "Identifier") {
            calleeName = expr.callee.name;
        }

        if (calleeName === "free") {
          const arg = this.emitExpr(expr.args[0]);
          let ptrReg = arg.reg;
          if (arg.type !== "i8*") {
            ptrReg = this.fresh();
            this.out.push(`  ${ptrReg} = bitcast ${arg.type} ${arg.reg} to i8*`);
          }
          this.out.push(`  call void @free(i8* ${ptrReg})`);
          return { reg: "0", type: "void" };
        }

        if (calleeName === "panic") {
          const arg = this.emitExpr(expr.args[0]);
          let ptrReg = arg.reg;
          if (arg.type === "%str") {
            ptrReg = this.fresh();
            this.out.push(`  ${ptrReg} = extractvalue %str ${arg.reg}, 0`);
          }
          this.out.push(`  call void @vks_panic(i8* ${ptrReg})`);
          this.out.push(`  unreachable`);
          return { reg: "0", type: "void" };
        }

        if (calleeName === "thread_join") {
          const handle = this.emitExpr(expr.args[0]);
          this.out.push(`  call void @vks_thread_join(i8* ${handle.reg})`);
          return { reg: "0", type: "void" };
        }
        if (calleeName === "mutex_create") {
          const m = this.fresh();
          this.out.push(`  ${m} = call i8* @vks_mutex_create()`);
          return { reg: m, type: "i8*" };
        }
        if (calleeName === "mutex_lock") {
          const m = this.emitExpr(expr.args[0]);
          this.out.push(`  call void @vks_mutex_lock(i8* ${m.reg})`);
          return { reg: "0", type: "void" };
        }
        if (calleeName === "mutex_unlock") {
          const m = this.emitExpr(expr.args[0]);
          this.out.push(`  call void @vks_mutex_unlock(i8* ${m.reg})`);
          return { reg: "0", type: "void" };
        }
        if (calleeName === "mutex_destroy") {
          const m = this.emitExpr(expr.args[0]);
          this.out.push(`  call void @vks_mutex_destroy(i8* ${m.reg})`);
          return { reg: "0", type: "void" };
        }

        if (calleeName === "array_length") {
            const arr = this.emitExpr(expr.args[0]);
            const structName = this.lookupStructName(arr.type);
            const lenReg = this.fresh();
            this.out.push(`  ${lenReg} = extractvalue %${structName} ${arr.reg}, 0`);
            return { reg: lenReg, type: "i32" };
        }

        if (calleeName === "array_push") {
            const arr = this.emitLValue(expr.args[0]);
            const val = this.emitExpr(expr.args[1]);
            
            const structName = this.lookupStructName(arr.type.slice(0, -1));
            const elemType = val.type;
            
            // Generate inline array_push logic
            const lenPtr = this.fresh();
            this.out.push(`  ${lenPtr} = getelementptr inbounds %${structName}, %${structName}* ${arr.reg}, i32 0, i32 0`);
            const len = this.fresh();
            this.out.push(`  ${len} = load i32, i32* ${lenPtr}`);
            
            const capPtr = this.fresh();
            this.out.push(`  ${capPtr} = getelementptr inbounds %${structName}, %${structName}* ${arr.reg}, i32 0, i32 1`);
            const cap = this.fresh();
            this.out.push(`  ${cap} = load i32, i32* ${capPtr}`);
            
            const cond = this.fresh();
            this.out.push(`  ${cond} = icmp eq i32 ${len}, ${cap}`);
            
            const resizeBlock = this.freshBlock("resize");
            const pushBlock = this.freshBlock("push");
            
            this.out.push(`  br i1 ${cond}, label %${resizeBlock}, label %${pushBlock}`);
            
            this.out.push(`${resizeBlock}:`);
            const newCap = this.fresh();
            this.out.push(`  ${newCap} = mul i32 ${cap}, 2`);
            const elemSize = llvmTypeSize(elemType);
            const newBytes = this.fresh();
            this.out.push(`  ${newBytes} = mul i32 ${newCap}, ${elemSize}`);
            const newBytes64 = this.fresh();
            this.out.push(`  ${newBytes64} = zext i32 ${newBytes} to i64`);
            
            const newData = this.fresh();
            this.out.push(`  ${newData} = call i8* @malloc(i64 ${newBytes64})`);
            
            const dataPtr = this.fresh();
            this.out.push(`  ${dataPtr} = getelementptr inbounds %${structName}, %${structName}* ${arr.reg}, i32 0, i32 2`);
            const oldData = this.fresh();
            this.out.push(`  ${oldData} = load ${elemType}*, ${elemType}** ${dataPtr}`);
            const oldDataI8 = this.fresh();
            this.out.push(`  ${oldDataI8} = bitcast ${elemType}* ${oldData} to i8*`);
            
            const oldBytes = this.fresh();
            this.out.push(`  ${oldBytes} = mul i32 ${len}, ${elemSize}`);
            const oldBytes64 = this.fresh();
            this.out.push(`  ${oldBytes64} = zext i32 ${oldBytes} to i64`);
            
            this.out.push(`  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 1 ${newData}, i8* align 1 ${oldDataI8}, i64 ${oldBytes64}, i1 false)`);
            this.out.push(`  call void @free(i8* ${oldDataI8})`);
            
            const newDataTyped = this.fresh();
            this.out.push(`  ${newDataTyped} = bitcast i8* ${newData} to ${elemType}*`);
            this.out.push(`  store ${elemType}* ${newDataTyped}, ${elemType}** ${dataPtr}`);
            this.out.push(`  store i32 ${newCap}, i32* ${capPtr}`);
            this.out.push(`  br label %${pushBlock}`);
            
            this.out.push(`${pushBlock}:`);
            const currDataPtr = this.fresh();
            this.out.push(`  ${currDataPtr} = getelementptr inbounds %${structName}, %${structName}* ${arr.reg}, i32 0, i32 2`);
            const currData = this.fresh();
            this.out.push(`  ${currData} = load ${elemType}*, ${elemType}** ${currDataPtr}`);
            
            const targetPtr = this.fresh();
            this.out.push(`  ${targetPtr} = getelementptr inbounds ${elemType}, ${elemType}* ${currData}, i32 ${len}`);
            this.out.push(`  store ${elemType} ${val.reg}, ${elemType}* ${targetPtr}`);
            
            const newLen = this.fresh();
            this.out.push(`  ${newLen} = add i32 ${len}, 1`);
            this.out.push(`  store i32 ${newLen}, i32* ${lenPtr}`);
            
            return { reg: "0", type: "void" };
        }

        if (calleeName === "Ok" || calleeName === "Err") {
            if (!expectedType || !expectedType.startsWith("%Result_")) {
                throw new Error(`${calleeName}() requires expected Result type context`);
            }
            const structName = this.lookupStructName(expectedType);
            const { type: okType } = this.resolveField(structName, "value");
            const { type: errType } = this.resolveField(structName, "error");

            const arg = this.emitExpr(expr.args[0], calleeName === "Ok" ? okType : errType);
            
            const reg = this.fresh("result");
            this.out.push(`  ${reg} = alloca %${structName}`);
            
            const isOkPtr = this.fresh();
            this.out.push(`  ${isOkPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 0`);
            this.out.push(`  store i1 ${calleeName === "Ok" ? 1 : 0}, i1* ${isOkPtr}`);
            
            const valPtr = this.fresh();
            const slotIndex = calleeName === "Ok" ? 1 : 2;
            const slotType = calleeName === "Ok" ? okType : errType;
            this.out.push(`  ${valPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 ${slotIndex}`);
            this.out.push(`  store ${slotType} ${arg.reg}, ${slotType}* ${valPtr}`);
            
            const loaded = this.fresh();
            this.out.push(`  ${loaded} = load %${structName}, %${structName}* ${reg}`);
            return { reg: loaded, type: `%${structName}` };
        }

        if (calleeName === "print") {
            const arg = this.emitExpr(expr.args[0]);
            if (arg.type === "i32") {
                this.out.push(`  call void @vk_print_i32(i32 ${arg.reg})`);
            } else if (arg.type === "double") {
                this.out.push(`  call void @vk_print_f64(double ${arg.reg})`);
            } else if (arg.type === "i1") {
                // zext to i32 for printing
                const zext = this.fresh();
                this.out.push(`  ${zext} = zext i1 ${arg.reg} to i32`);
                this.out.push(`  call void @vk_print_bool(i32 ${zext})`);
            } else if (arg.type === "%str") {
                // Extract ptr and len from struct value
                const regStruct = arg.reg;
                const regPtr = this.fresh();
                this.out.push(`  ${regPtr} = extractvalue %str ${regStruct}, 0`);
                const regLen = this.fresh();
                this.out.push(`  ${regLen} = extractvalue %str ${regStruct}, 1`);
                this.out.push(`  call void @vk_print_str(i8* ${regPtr}, i64 ${regLen})`);
            } else {
                this.out.push(`  ; TODO: print for type ${arg.type}`);
            }
            return { reg: "0", type: "void" };
        }
        
        if (calleeName === "sqrt") {
            const arg = this.emitExpr(expr.args[0]);
            const reg = this.fresh();
            this.out.push(`  ${reg} = call double @vk_sqrt(double ${arg.reg})`);
            return { reg, type: "double" };
        }
        
        if (calleeName === "get_args") {
            const reg = this.fresh();
            this.out.push(`  ${reg} = call %array_str @vks_get_args()`);
            return { reg, type: "%array_str" };
        }
        if (calleeName === "get_env") {
            const arg = this.emitExpr(expr.args[0]);
            const reg = this.fresh();
            this.out.push(`  ${reg} = call %str* @vks_get_env(${arg.type} ${arg.reg})`);
            return { reg, type: "%str*" };
        }
        if (calleeName === "str_split") {
            const arg1 = this.emitExpr(expr.args[0]);
            const arg2 = this.emitExpr(expr.args[1]);
            
            const ptr1 = this.fresh();
            this.out.push(`  ${ptr1} = extractvalue %str ${arg1.reg}, 0`);
            const len1 = this.fresh();
            this.out.push(`  ${len1} = extractvalue %str ${arg1.reg}, 1`);
            
            const ptr2 = this.fresh();
            this.out.push(`  ${ptr2} = extractvalue %str ${arg2.reg}, 0`);
            const len2 = this.fresh();
            this.out.push(`  ${len2} = extractvalue %str ${arg2.reg}, 1`);
            
            const ptrReg = this.fresh();
            this.out.push(`  ${ptrReg} = call %array_str* @vks_str_split(i8* ${ptr1}, i64 ${len1}, i8* ${ptr2}, i64 ${len2})`);
            
            const reg = this.fresh();
            this.out.push(`  ${reg} = load %array_str, %array_str* ${ptrReg}`);
            
            const ptrI8 = this.fresh();
            this.out.push(`  ${ptrI8} = bitcast %array_str* ${ptrReg} to i8*`);
            this.out.push(`  call void @free(i8* ${ptrI8})`);
            
            return { reg, type: "%array_str" };
        }
        if (calleeName === "str_replace") {
            const arg1 = this.emitExpr(expr.args[0]);
            const arg2 = this.emitExpr(expr.args[1]);
            const arg3 = this.emitExpr(expr.args[2]);
            const reg = this.fresh();
            this.out.push(`  ${reg} = call %str @vks_str_replace(${arg1.type} ${arg1.reg}, ${arg2.type} ${arg2.reg}, ${arg3.type} ${arg3.reg})`);
            return { reg, type: "%str" };
        }
        if (calleeName === "free_str_array") {
            const arg = this.emitExpr(expr.args[0]);
            this.out.push(`  call void @vk_free_str_array(${arg.type} ${arg.reg})`);
            return { reg: "0", type: "void" };
        }
        if (calleeName === "tcp_connect") {
            const arg1 = this.emitExpr(expr.args[0]);
            const arg2 = this.emitExpr(expr.args[1]);
            
            const ptrReg = this.fresh();
            this.out.push(`  ${ptrReg} = extractvalue %str ${arg1.reg}, 0`);
            const lenReg = this.fresh();
            this.out.push(`  ${lenReg} = extractvalue %str ${arg1.reg}, 1`);
            
            const reg = this.fresh();
            this.out.push(`  ${reg} = call i8* @vks_tcp_connect(i8* ${ptrReg}, i64 ${lenReg}, ${arg2.type} ${arg2.reg})`);
            return { reg, type: "i8*" };
        }
        if (calleeName === "socket_send") {
            const arg1 = this.emitExpr(expr.args[0]);
            const arg2 = this.emitExpr(expr.args[1]);
            
            const ptrReg = this.fresh();
            this.out.push(`  ${ptrReg} = extractvalue %str ${arg2.reg}, 0`);
            const lenReg = this.fresh();
            this.out.push(`  ${lenReg} = extractvalue %str ${arg2.reg}, 1`);
            
            const reg = this.fresh();
            this.out.push(`  ${reg} = call i32 @vks_socket_send(${arg1.type} ${arg1.reg}, i8* ${ptrReg}, i64 ${lenReg})`);
            return { reg, type: "i32" };
        }
        if (calleeName === "socket_recv") {
            const arg1 = this.emitExpr(expr.args[0]);
            const ptr = this.fresh();
            this.out.push(`  ${ptr} = call %str* @vks_socket_recv_all(${arg1.type} ${arg1.reg})`);
            const reg = this.fresh();
            this.out.push(`  ${reg} = load %str, %str* ${ptr}`);
            
            const ptrI8 = this.fresh();
            this.out.push(`  ${ptrI8} = bitcast %str* ${ptr} to i8*`);
            this.out.push(`  call void @free(i8* ${ptrI8})`);
            
            return { reg, type: "%str" };
        }
        if (calleeName === "socket_close") {
            const arg1 = this.emitExpr(expr.args[0]);
            this.out.push(`  call void @vks_socket_close(${arg1.type} ${arg1.reg})`);
            return { reg: "0", type: "void" };
        }

        const args = expr.args.map(a => this.emitExpr(a));
        const argList = args.map(a => `${a.type} ${a.reg}`).join(", ");
        
        const retType = this.functionReturns.get(calleeName) || "i32";
        const reg = this.fresh();
        this.out.push(`  ${reg} = call ${retType} @${calleeName}(${argList})`);
        return { reg, type: retType };
      }

      case "AllocExpr": {
        const { reg: sizeReg, type: sizeType } = this.emitExpr(expr.sizeExpr);
        let argReg = sizeReg;
        
        // malloc takes i64, so zext if it's i32
        if (sizeType === "i32") {
          argReg = this.fresh();
          this.out.push(`  ${argReg} = zext i32 ${sizeReg} to i64`);
        }
        
        const reg = this.fresh();
        this.out.push(`  ${reg} = call i8* @malloc(i64 ${argReg})`);
        return { reg, type: "i8*" };
      }

      case "AssignmentExpr": {
        const { reg: valReg, type: valType } = this.emitExpr(expr.value);
        const lval = this.emitLValue(expr.target);
        this.out.push(`  store ${valType} ${valReg}, ${lval.type} ${lval.reg}`);
        return { reg: valReg, type: valType };
      }

      case "PostfixExpr": {
        const lval = this.emitLValue(expr.operand);
        const valType = lval.type.slice(0, -1);
        const op = expr.operator.lexeme;
        const isFloat = valType === "float" || valType === "double";
        
        const oldReg = this.fresh();
        this.out.push(`  ${oldReg} = load ${valType}, ${lval.type} ${lval.reg}`);
        
        const oneReg = isFloat ? "1.0" : "1";
        const newReg = this.fresh();
        if (op === "++") {
          this.out.push(`  ${newReg} = ${isFloat ? "fadd" : "add"} ${valType} ${oldReg}, ${oneReg}`);
        } else {
          this.out.push(`  ${newReg} = ${isFloat ? "fsub" : "sub"} ${valType} ${oldReg}, ${oneReg}`);
        }
        
        this.out.push(`  store ${valType} ${newReg}, ${lval.type} ${lval.reg}`);
        return { reg: oldReg, type: valType };
      }

      case "UnaryExpr": {
        const op = expr.operator.lexeme;
        
        if (op === "&") {
          // Address-Of: Return the pointer to the identifier
          if (expr.operand.kind === "Identifier") {
            const varName = expr.operand.name;
            const llvmType = this.scope.resolve(varName) || "i32";
            return { reg: `%${varName}`, type: `${llvmType}*` };
          } else {
            this.out.push(`  ; TODO: Address-Of (&) requires an identifier/l-value`);
            return { reg: "null", type: "i8*" };
          }
        } 
        else if (op === "*") {
          // Dereference: Evaluate operand to get a pointer, then load its value
          const { reg: ptrReg, type: ptrType } = this.emitExpr(expr.operand);
          if (!ptrType.endsWith("*")) {
            this.out.push(`  ; TODO: Dereference (*) requires a pointer type, got ${ptrType}`);
            return { reg: "0", type: "i32" };
          }
          const valType = ptrType.slice(0, -1);
          const reg = this.fresh();
          this.out.push(`  ${reg} = load ${valType}, ${ptrType} ${ptrReg}`);
          return { reg, type: valType };
        }
        else if (op === "!" || op === "-") {
          const { reg, type } = this.emitExpr(expr.operand);
          const newReg = this.fresh();
          if (op === "!") {
             this.out.push(`  ${newReg} = xor i1 ${reg}, 1`);
             return { reg: newReg, type: "i1" };
          } else {
             const isFloat = type === "float" || type === "double";
             this.out.push(`  ${newReg} = ${isFloat ? "fneg" : "sub"} ${type} ${isFloat ? "" : "0, "}${reg}`);
             return { reg: newReg, type };
          }
        }
        
        this.out.push(`  ; TODO: unhandled unary op ${op}`);
        return { reg: "0", type: "i32" };
      }

      case "ArrayLiteral": {
        let arrayType = expectedType;
        if (!arrayType && expr.elements.length > 0) {
           // Try to infer from first element
           const first = this.emitExpr(expr.elements[0]);
           arrayType = `%array_${first.type}`;
        }
        if (!arrayType) {
           throw new Error("Cannot infer array type for empty literal");
        }
        
        const structName = this.lookupStructName(arrayType);
        // We know it's a dynamic array if it matches array_T
        let elemType = structName.replace("array_", "");
        if (!["i8","i16","i32","i64","float","double","i1"].includes(elemType)) elemType = "%" + elemType;
        
        const reg = this.fresh("arr");
        this.out.push(`  ${reg} = alloca %${structName}`);
        
        // Initial capacity = 8
        const initialCap = 8;
        const elemSize = llvmTypeSize(elemType);
        const bytes = initialCap * elemSize;
        
        const rawData = this.fresh();
        this.out.push(`  ${rawData} = call i8* @malloc(i64 ${bytes})`);
        const typedData = this.fresh();
        this.out.push(`  ${typedData} = bitcast i8* ${rawData} to ${elemType}*`);
        
        const lenPtr = this.fresh();
        this.out.push(`  ${lenPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 0`);
        this.out.push(`  store i32 ${expr.elements.length}, i32* ${lenPtr}`);
        
        const capPtr = this.fresh();
        this.out.push(`  ${capPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 1`);
        this.out.push(`  store i32 ${initialCap}, i32* ${capPtr}`);
        
        const dataPtr = this.fresh();
        this.out.push(`  ${dataPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 2`);
        this.out.push(`  store ${elemType}* ${typedData}, ${elemType}** ${dataPtr}`);
        
        // Populate elements
        for (let i = 0; i < expr.elements.length; i++) {
           const val = this.emitExpr(expr.elements[i], elemType);
           const elemPtr = this.fresh();
           this.out.push(`  ${elemPtr} = getelementptr inbounds ${elemType}, ${elemType}* ${typedData}, i32 ${i}`);
           this.out.push(`  store ${elemType} ${val.reg}, ${elemType}* ${elemPtr}`);
        }
        
        const valReg = this.fresh();
        this.out.push(`  ${valReg} = load %${structName}, %${structName}* ${reg}`);
        return { reg: valReg, type: `%${structName}` };
      }
      
      case "StructLiteral": {
        const structName = expr.name;
        const reg = this.fresh("struct");
        this.out.push(`  ${reg} = alloca %${structName}`);
        for (const f of expr.fields) {
          const { index, type } = this.resolveField(structName, f.name.name);
          const fieldPtr = this.fresh();
          this.out.push(`  ${fieldPtr} = getelementptr inbounds %${structName}, %${structName}* ${reg}, i32 0, i32 ${index}`);
          const val = this.emitExpr(f.value);
          this.out.push(`  store ${type} ${val.reg}, ${type}* ${fieldPtr}`);
        }
        const valReg = this.fresh();
        this.out.push(`  ${valReg} = load %${structName}, %${structName}* ${reg}`);
        return { reg: valReg, type: `%${structName}` };
      }

      case "FieldAccessExpr":
      case "IndexAccessExpr": {
        const lval = this.emitLValue(expr);
        const valType = lval.type.slice(0, -1);
        const reg = this.fresh();
        this.out.push(`  ${reg} = load ${valType}, ${lval.type} ${lval.reg}`);
        return { reg, type: valType };
      }

      case "SpawnExpr": {
        const call = expr.call;
        const calleeName = call.callee.kind === "Identifier" ? call.callee.name : "unknown";
        
        const emittedArgs = call.args.map(arg => this.emitExpr(arg));
        let argsPtr = "null";
        let structTypeStr = "";
        
        if (emittedArgs.length > 0) {
            structTypeStr = `{ ${emittedArgs.map(a => a.type).join(", ")} }`;
            const structSize = emittedArgs.reduce((sum, a) => sum + llvmTypeSize(a.type), 0);
            
            const rawMalloc = this.fresh();
            this.out.push(`  ${rawMalloc} = call i8* @malloc(i64 ${structSize})`);
            const typedMalloc = this.fresh();
            this.out.push(`  ${typedMalloc} = bitcast i8* ${rawMalloc} to ${structTypeStr}*`);
            
            for (let i = 0; i < emittedArgs.length; i++) {
                const fieldPtr = this.fresh();
                this.out.push(`  ${fieldPtr} = getelementptr inbounds ${structTypeStr}, ${structTypeStr}* ${typedMalloc}, i32 0, i32 ${i}`);
                this.out.push(`  store ${emittedArgs[i].type} ${emittedArgs[i].reg}, ${emittedArgs[i].type}* ${fieldPtr}`);
            }
            
            argsPtr = rawMalloc;
        }

        const wrapperName = `@.spawn_wrapper_${calleeName}_${this.tempCount++}`;
        
        const tramp = [];
        tramp.push(`define void ${wrapperName}(i8* %args_ptr) {`);
        tramp.push(`entry:`);
        
        const callArgs: string[] = [];
        if (emittedArgs.length > 0) {
            const typedPtr = "%typed_args";
            tramp.push(`  ${typedPtr} = bitcast i8* %args_ptr to ${structTypeStr}*`);
            for (let i = 0; i < emittedArgs.length; i++) {
                const fieldPtr = `%arg_ptr_${i}`;
                tramp.push(`  ${fieldPtr} = getelementptr inbounds ${structTypeStr}, ${structTypeStr}* ${typedPtr}, i32 0, i32 ${i}`);
                const val = `%arg_val_${i}`;
                tramp.push(`  ${val} = load ${emittedArgs[i].type}, ${emittedArgs[i].type}* ${fieldPtr}`);
                callArgs.push(`${emittedArgs[i].type} ${val}`);
            }
            tramp.push(`  call void @free(i8* %args_ptr)`);
        }
        
        const retType = this.functionReturns.get(calleeName) || "void";
        tramp.push(`  ${retType !== "void" ? "%ret = " : ""}call ${retType} @${calleeName}(${callArgs.join(", ")})`);
        tramp.push(`  ret void`);
        tramp.push(`}`);
        tramp.push("");
        
        this.trampolines.push(tramp.join("\n"));
        
        const threadReg = this.fresh();
        this.out.push(`  ${threadReg} = call i8* @vks_spawn(i8* bitcast (void (i8*)* ${wrapperName} to i8*), i8* ${argsPtr})`);
        
        return { reg: threadReg, type: "i8*" };
      }

      case "NullLiteral": {
        return { reg: "null", type: "i8*" };
      }

      default:
        this.out.push(`  ; TODO: unhandled expr kind ${expr.kind}`);
        return { reg: "0", type: "i32" };
    }
  }

  private binaryOp(op: string, type: string): string {
    const isFloat = type === "float" || type === "double";
    switch (op) {
      case "+": return isFloat ? "fadd" : "add";
      case "-": return isFloat ? "fsub" : "sub";
      case "*": return isFloat ? "fmul" : "mul";
      case "/": return isFloat ? "fdiv" : "sdiv";
      case "==": return isFloat ? "fcmp oeq" : "icmp eq";
      case "!=": return isFloat ? "fcmp one" : "icmp ne";
      case "<": return isFloat ? "fcmp olt" : "icmp slt";
      case ">": return isFloat ? "fcmp ogt" : "icmp sgt";
      case "<=": return isFloat ? "fcmp ole" : "icmp sle";
      case ">=": return isFloat ? "fcmp oge" : "icmp sge";
      default: return "add"; // fallback
    }
  }
}
