// ============================================================
// Vektor — Tree-Walking Interpreter
// ============================================================
// Evaluates the AST produced by the parser. Walks each node
// and produces runtime values, executing the program.
// ============================================================

import {
  Program, Declaration, Statement, Expression, Block,
  IntegerLiteral, FloatLiteral, StringLiteral, CharLiteral,
  BooleanLiteral, NullLiteral, Identifier,
  BinaryExpr, UnaryExpr, PostfixExpr, CallExpr,
  FieldAccessExpr, IndexAccessExpr, StructLiteral,
  CastExpr, AllocExpr, CloneExpr, ArrayLiteral, AssignmentExpr,
  LetStatement, ConstStatement, ReturnStatement,
  IfStatement, WhileStatement, ForStatement, ForInStatement,
  ExpressionStatement,
  ImportDecl, StructDecl, FunctionDecl, FunctionParam,
  TypeNode, ASTNode,
} from "./ast.js";

import { TokenType } from "./tokens.js";
import { RuntimeError, ReturnSignal } from "./errors.js";
import { registerInterpreterBuiltins } from "./stdlib.js";
import { Environment } from "./environment.js";
import { MemoryHeap } from "./memory.js";
import {
  VKSValue, VKSFunction, VKSBuiltinFunction,
  mkInteger, mkFloat, mkBool, mkByte, mkString, mkNull, mkVoid,
  mkArray, mkStruct, mkResult, mkPointer,
  isTruthy, isCallable, isBuiltin, isUserFunction,
  stringify, deepClone, mkMap,
} from "./values.js";

// ── Interpreter ──────────────────────────────────────────────

export class Interpreter {
  /** The global environment */
  private globalEnv: Environment;
  /** The current active environment (changes as we enter/exit scopes) */
  private currentEnv: Environment;
  /** Simulated heap memory */
  private memory: MemoryHeap;
  /** Struct declarations — stores field definitions for validation */
  private structDefs: Map<string, StructDecl> = new Map();
  /** Captured stdout output (for testing) */
  private output: string[] = [];
  /** Custom output handler (for testing) */
  private outputHandler: ((text: string) => void) | null = null;

  constructor() {
    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;
    this.memory = new MemoryHeap();
    this.registerBuiltins();
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Execute a parsed program.
   */
  execute(program: Program): void {
    // 1. Register all struct declarations
    for (const decl of program.declarations) {
      if (decl.kind === "StructDecl") {
        this.visitStructDecl(decl);
      }
    }

    // 2. Register all function declarations
    for (const decl of program.declarations) {
      if (decl.kind === "FunctionDecl") {
        this.visitFunctionDecl(decl);
      }
    }

    // 3. Register all top-level constants
    for (const decl of program.declarations) {
      if (decl.kind === "ConstStatement") {
        this.visitConstStatement(decl);
      }
    }

    // 4. Find and execute main()
    let mainFn: VKSValue;
    try {
      mainFn = this.globalEnv.get("main");
    } catch {
      throw new RuntimeError(1, 1, "No 'main' function found. Every Vektor program must have a main() function.");
    }

    if (!isCallable(mainFn)) {
      throw new RuntimeError(1, 1, "No 'main' function found. Every Vektor program must have a main() function.");
    }

    this.callFunction(mainFn, [], 1, 1);
  }

  /**
   * Get captured output (for testing).
   */
  getOutput(): string[] {
    return [...this.output];
  }

  /**
   * Set a custom output handler (for testing — captures print() output).
   */
  setOutputHandler(handler: (text: string) => void): void {
    this.outputHandler = handler;
  }

  // ── Built-in Functions ───────────────────────────────────

  private registerBuiltins(): void {
    registerInterpreterBuiltins(
      (name, arity, call) => {
        this.globalEnv.define(name, {
          type: "function",
          name,
          arity,
          call,
        } as VKSBuiltinFunction);
      },
      {
        onPrint: (text) => {
          if (this.outputHandler) this.outputHandler(text);
          else console.log(text);
          this.output.push(text);
        },
      },
    );
  }

  // ── Declarations ─────────────────────────────────────────

  private visitStructDecl(node: StructDecl): void {
    this.structDefs.set(node.name.name, node);
  }

  private visitFunctionDecl(node: FunctionDecl): void {
    const fn: VKSFunction = {
      type: "function",
      declaration: node,
      closure: this.currentEnv,
    };
    this.currentEnv.define(node.name.name, fn);
  }

  // ── Statements ───────────────────────────────────────────

  private visitStatement(node: Statement): void {
    switch (node.kind) {
      case "LetStatement":
        return this.visitLetStatement(node);
      case "ConstStatement":
        return this.visitConstStatement(node);
      case "ReturnStatement":
        return this.visitReturnStatement(node);
      case "IfStatement":
        return this.visitIfStatement(node);
      case "WhileStatement":
        return this.visitWhileStatement(node);
      case "ForStatement":
        return this.visitForStatement(node);
      case "ForInStatement":
        return this.visitForInStatement(node);
      case "ExpressionStatement":
        return this.visitExpressionStatement(node);
      case "Block":
        return this.visitBlock(node);
      default:
        throw this.error(node, `Unknown statement kind: ${(node as any).kind}`);
    }
  }

  private visitLetStatement(node: LetStatement): void {
    let value: VKSValue = mkNull();
    if (node.initializer) {
      value = this.visitExpression(node.initializer);
    }

    // Apply type-based defaults if no initializer and type is specified
    if (!node.initializer && node.type) {
      value = this.defaultForType(node.type);
    }

    this.currentEnv.define(node.name.name, value);
  }

  private visitConstStatement(node: ConstStatement): void {
    const value = this.visitExpression(node.initializer);
    this.currentEnv.define(node.name.name, value, true);
  }

  private visitReturnStatement(node: ReturnStatement): void {
    let value: VKSValue = mkVoid();
    if (node.value) {
      value = this.visitExpression(node.value);
    }
    throw new ReturnSignal(value);
  }

  private visitIfStatement(node: IfStatement): void {
    const condition = this.visitExpression(node.condition);
    if (isTruthy(condition)) {
      this.visitBlock(node.thenBlock);
    } else if (node.elseBlock) {
      if (node.elseBlock.kind === "Block") {
        this.visitBlock(node.elseBlock);
      } else {
        // else if chain
        this.visitStatement(node.elseBlock);
      }
    }
  }

  private visitWhileStatement(node: WhileStatement): void {
    while (isTruthy(this.visitExpression(node.condition))) {
      this.visitBlock(node.body);
    }
  }

  private visitForStatement(node: ForStatement): void {
    // C-style for: for (init; condition; update) { body }
    const prevEnv = this.currentEnv;
    this.currentEnv = new Environment(this.currentEnv);

    try {
      // Init
      if (node.init) {
        this.visitStatement(node.init);
      }

      // Loop
      while (true) {
        // Condition check
        if (node.condition) {
          const cond = this.visitExpression(node.condition);
          if (!isTruthy(cond)) break;
        }

        // Body
        this.visitBlock(node.body);

        // Update
        if (node.update) {
          this.visitExpression(node.update);
        }
      }
    } finally {
      this.currentEnv = prevEnv;
    }
  }

  private visitForInStatement(node: ForInStatement): void {
    const startVal = this.visitExpression(node.start);
    const endVal = this.visitExpression(node.end);

    if (startVal.type !== "integer" || endVal.type !== "integer") {
      throw this.error(node, "Range bounds in 'for..in' must be integers.");
    }

    const prevEnv = this.currentEnv;
    this.currentEnv = new Environment(this.currentEnv);

    try {
      this.currentEnv.define(node.variable.name, mkInteger(startVal.value));

      for (let i = startVal.value; i < endVal.value; i++) {
        this.currentEnv.set(node.variable.name, mkInteger(i));
        this.visitBlock(node.body);
      }
    } finally {
      this.currentEnv = prevEnv;
    }
  }

  private visitExpressionStatement(node: ExpressionStatement): void {
    this.visitExpression(node.expression);
  }

  private visitBlock(node: Block): void {
    const prevEnv = this.currentEnv;
    this.currentEnv = new Environment(this.currentEnv);

    try {
      for (const stmt of node.statements) {
        this.visitStatement(stmt);
      }
    } finally {
      this.currentEnv = prevEnv;
    }
  }

  // ── Expressions ──────────────────────────────────────────

  private visitExpression(node: Expression): VKSValue {
    switch (node.kind) {
      case "IntegerLiteral":
        return mkInteger(node.value);
      case "FloatLiteral":
        return mkFloat(node.value);
      case "StringLiteral":
        return mkString(node.value);
      case "CharLiteral":
        return mkByte(node.value.charCodeAt(0));
      case "BooleanLiteral":
        return mkBool(node.value);
      case "NullLiteral":
        return mkNull();
      case "Identifier":
        return this.visitIdentifier(node);
      case "BinaryExpr":
        return this.visitBinaryExpr(node);
      case "UnaryExpr":
        return this.visitUnaryExpr(node);
      case "PostfixExpr":
        return this.visitPostfixExpr(node);
      case "CallExpr":
        return this.visitCallExpr(node);
      case "FieldAccessExpr":
        return this.visitFieldAccessExpr(node);
      case "IndexAccessExpr":
        return this.visitIndexAccessExpr(node);
      case "StructLiteral":
        return this.visitStructLiteral(node);
      case "CastExpr":
        return this.visitCastExpr(node);
      case "AllocExpr":
        return this.visitAllocExpr(node);
      case "CloneExpr":
        return this.visitCloneExpr(node);
      case "ArrayLiteral":
        return this.visitArrayLiteral(node);
      case "AssignmentExpr":
        return this.visitAssignmentExpr(node);
      default:
        throw this.error(node, `Unknown expression kind: ${(node as any).kind}`);
    }
  }

  private visitIdentifier(node: Identifier): VKSValue {
    try {
      return this.currentEnv.get(node.name);
    } catch (e: any) {
      throw this.error(node, e.message);
    }
  }

  private visitBinaryExpr(node: BinaryExpr): VKSValue {
    const left = this.visitExpression(node.left);
    const op = node.operator.lexeme;

    // Short-circuit for logical operators
    if (op === "&&" || op === "and") {
      return mkBool(isTruthy(left) && isTruthy(this.visitExpression(node.right)));
    }
    if (op === "||" || op === "or") {
      return mkBool(isTruthy(left) || isTruthy(this.visitExpression(node.right)));
    }

    const right = this.visitExpression(node.right);

    // Null comparisons
    if (left.type === "null" || right.type === "null") {
      if (op === "==") return mkBool(left.type === "null" && right.type === "null");
      if (op === "!=") return mkBool(left.type !== "null" || right.type !== "null");
      throw this.error(node, `Cannot use operator '${op}' with null values.`);
    }

    // Integer arithmetic
    if (left.type === "integer" && right.type === "integer") {
      return this.intBinaryOp(op, left.value, right.value, node);
    }

    // Float arithmetic
    if (left.type === "float" && right.type === "float") {
      return this.floatBinaryOp(op, left.value, right.value, node);
    }

    // Mixed int + float → promote to float
    if (left.type === "integer" && right.type === "float") {
      return this.floatBinaryOp(op, left.value, right.value, node);
    }
    if (left.type === "float" && right.type === "integer") {
      return this.floatBinaryOp(op, left.value, right.value, node);
    }

    // Byte arithmetic (treat as small ints)
    if (left.type === "byte" && right.type === "byte") {
      return this.intBinaryOp(op, left.value, right.value, node);
    }

    // Boolean operations
    if (left.type === "bool" && right.type === "bool") {
      if (op === "==") return mkBool(left.value === right.value);
      if (op === "!=") return mkBool(left.value !== right.value);
      throw this.error(node, `Cannot use operator '${op}' with booleans. Use '&&', '||', or comparison.`);
    }

    // String operations
    if (left.type === "string" && right.type === "string") {
      if (op === "+") return mkString(left.value + right.value);
      if (op === "==") return mkBool(left.value === right.value);
      if (op === "!=") return mkBool(left.value !== right.value);
      if (op === "<") return mkBool(left.value < right.value);
      if (op === ">") return mkBool(left.value > right.value);
      if (op === "<=") return mkBool(left.value <= right.value);
      if (op === ">=") return mkBool(left.value >= right.value);
      throw this.error(node, `Cannot use operator '${op}' with strings.`);
    }

    throw this.error(
      node,
      `Type mismatch: cannot apply operator '${op}' to '${left.type}' and '${right.type}'.`
    );
  }

  private intBinaryOp(op: string, a: number, b: number, node: ASTNode): VKSValue {
    switch (op) {
      case "+": return mkInteger(a + b);
      case "-": return mkInteger(a - b);
      case "*": return mkInteger(a * b);
      case "/":
        if (b === 0) throw this.error(node, "Division by zero.");
        return mkInteger(Math.trunc(a / b));
      case "%":
        if (b === 0) throw this.error(node, "Modulo by zero.");
        return mkInteger(a % b);
      case "==": return mkBool(a === b);
      case "!=": return mkBool(a !== b);
      case "<": return mkBool(a < b);
      case ">": return mkBool(a > b);
      case "<=": return mkBool(a <= b);
      case ">=": return mkBool(a >= b);
      default:
        throw this.error(node, `Unsupported integer operator '${op}'.`);
    }
  }

  private floatBinaryOp(op: string, a: number, b: number, node: ASTNode): VKSValue {
    switch (op) {
      case "+": return mkFloat(a + b);
      case "-": return mkFloat(a - b);
      case "*": return mkFloat(a * b);
      case "/":
        if (b === 0) throw this.error(node, "Division by zero.");
        return mkFloat(a / b);
      case "==": return mkBool(a === b);
      case "!=": return mkBool(a !== b);
      case "<": return mkBool(a < b);
      case ">": return mkBool(a > b);
      case "<=": return mkBool(a <= b);
      case ">=": return mkBool(a >= b);
      default:
        throw this.error(node, `Unsupported float operator '${op}'.`);
    }
  }

  private visitUnaryExpr(node: UnaryExpr): VKSValue {
    const op = node.operator.type;

    // Address-of: &x
    if (op === TokenType.AMPERSAND) {
      if (node.operand.kind !== "Identifier") {
        throw this.error(node, "The '&' operator can only be applied to a variable.");
      }
      const varName = node.operand.name;
      const address = this.memory.addressOf(
        () => this.currentEnv.get(varName),
        (val: VKSValue) => this.currentEnv.set(varName, val)
      );
      return mkPointer(address);
    }

    // Dereference: *p
    if (op === TokenType.STAR) {
      const val = this.visitExpression(node.operand);
      if (val.type !== "pointer") {
        throw this.error(node, `Cannot dereference a non-pointer value (got '${val.type}').`);
      }
      try {
        return this.memory.deref(val.address);
      } catch (e: any) {
        throw this.error(node, e.message);
      }
    }

    const operand = this.visitExpression(node.operand);

    // Logical NOT: !, not
    if (op === TokenType.BANG || op === TokenType.NOT) {
      return mkBool(!isTruthy(operand));
    }

    // Negation: -
    if (op === TokenType.MINUS) {
      if (operand.type === "integer") return mkInteger(-operand.value);
      if (operand.type === "float") return mkFloat(-operand.value);
      throw this.error(node, `Cannot negate a '${operand.type}' value.`);
    }

    throw this.error(node, `Unknown unary operator '${node.operator.lexeme}'.`);
  }

  private visitPostfixExpr(node: PostfixExpr): VKSValue {
    const op = node.operator.type;

    if (node.operand.kind !== "Identifier") {
      throw this.error(node, "Postfix operators can only be applied to variables.");
    }

    const varName = node.operand.name;
    const current = this.visitIdentifier(node.operand);

    if (current.type !== "integer") {
      throw this.error(node, `Postfix '${node.operator.lexeme}' can only be applied to integers (got '${current.type}').`);
    }

    const oldValue = current.value;

    if (op === TokenType.PLUS_PLUS) {
      this.currentEnv.set(varName, mkInteger(oldValue + 1));
    } else if (op === TokenType.MINUS_MINUS) {
      this.currentEnv.set(varName, mkInteger(oldValue - 1));
    }

    return mkInteger(oldValue); // postfix returns old value
  }

  private visitCallExpr(node: CallExpr): VKSValue {
    // Special handling for Ok() and Err()
    if (node.callee.kind === "Identifier") {
      if (node.callee.name === "Ok") {
        if (node.args.length !== 1) {
          throw this.error(node, "Ok() takes exactly 1 argument.");
        }
        const val = this.visitExpression(node.args[0]);
        return mkResult(true, val);
      }
      if (node.callee.name === "Err") {
        if (node.args.length !== 1) {
          throw this.error(node, "Err() takes exactly 1 argument.");
        }
        const val = this.visitExpression(node.args[0]);
        return mkResult(false, val);
      }
      // Special handling for free()
      if (node.callee.name === "free") {
        if (node.args.length !== 1) {
          throw this.error(node, "free() takes exactly 1 argument.");
        }
        const ptr = this.visitExpression(node.args[0]);
        if (ptr.type !== "pointer") {
          throw this.error(node, `free() expects a pointer (got '${ptr.type}').`);
        }
        try {
          this.memory.free(ptr.address);
        } catch (e: any) {
          throw this.error(node, e.message);
        }
        return mkVoid();
      }
    }

    const callee = this.visitExpression(node.callee);

    if (!isCallable(callee)) {
      throw this.error(node, `'${stringify(callee)}' is not callable.`);
    }

    const args = node.args.map(arg => this.visitExpression(arg));

    return this.callFunction(callee, args, node.line, node.column);
  }

  /**
   * Execute a function call (user-defined or built-in).
   */
  private callFunction(
    fn: VKSValue,
    args: VKSValue[],
    callLine: number,
    callCol: number,
  ): VKSValue {
    if (isBuiltin(fn)) {
      if (fn.arity >= 0 && args.length !== fn.arity) {
        throw new RuntimeError(
          callLine, callCol,
          `'${fn.name}' expects ${fn.arity} argument(s) but got ${args.length}.`
        );
      }
      return fn.call(args);
    }

    if (isUserFunction(fn)) {
      const decl = fn.declaration;

      if (args.length !== decl.params.length) {
        throw new RuntimeError(
          callLine, callCol,
          `'${decl.name.name}' expects ${decl.params.length} argument(s) but got ${args.length}.`
        );
      }

      // Create new environment with closure as parent (lexical scoping)
      const funcEnv = new Environment(fn.closure);

      // Bind parameters
      for (let i = 0; i < decl.params.length; i++) {
        funcEnv.define(decl.params[i].name.name, args[i]);
      }

      // Execute body in the new environment
      const prevEnv = this.currentEnv;
      this.currentEnv = funcEnv;

      try {
        // Execute body statements directly (without creating another scope)
        for (const stmt of decl.body.statements) {
          this.visitStatement(stmt);
        }
      } catch (e) {
        if (e instanceof ReturnSignal) {
          return e.returnValue as VKSValue;
        }
        throw e;
      } finally {
        this.currentEnv = prevEnv;
      }

      return mkVoid();
    }

    throw new RuntimeError(callLine, callCol, "Internal error: value is callable but not a function.");
  }

  private visitFieldAccessExpr(node: FieldAccessExpr): VKSValue {
    const object = this.visitExpression(node.object);
    const fieldName = node.field.name;

    // Struct field access
    if (object.type === "struct") {
      if (!object.fields.has(fieldName)) {
        throw this.error(node, `Struct '${object.structName}' has no field '${fieldName}'.`);
      }
      return object.fields.get(fieldName)!;
    }

    // Result field access: .ok, .value, .error
    if (object.type === "result") {
      if (fieldName === "ok") return mkBool(object.isOk);
      if (fieldName === "value") {
        if (!object.isOk) {
          throw this.error(node, "Cannot access '.value' on an Err result.");
        }
        return object.value;
      }
      if (fieldName === "error") {
        if (object.isOk) {
          throw this.error(node, "Cannot access '.error' on an Ok result.");
        }
        return object.value;
      }
      throw this.error(node, `Result has no field '${fieldName}'. Use '.ok', '.value', or '.error'.`);
    }

    // String field access: .len, .bytes
    if (object.type === "string") {
      if (fieldName === "len") return mkInteger(object.value.length);
      if (fieldName === "bytes") {
        const bytes = Array.from(Buffer.from(object.value, "utf-8")).map(b => mkByte(b));
        return mkArray(bytes);
      }
      throw this.error(node, `String has no field '${fieldName}'. Use '.len' or '.bytes'.`);
    }

    // Array field access: .len
    if (object.type === "array") {
      if (fieldName === "len") return mkInteger(object.elements.length);
      throw this.error(node, `Array has no field '${fieldName}'.`);
    }

    throw this.error(node, `Cannot access field '${fieldName}' on a '${object.type}' value.`);
  }

  private visitIndexAccessExpr(node: IndexAccessExpr): VKSValue {
    const object = this.visitExpression(node.object);
    const index = this.visitExpression(node.index);

    if (index.type !== "integer") {
      throw this.error(node, `Array/pointer index must be an integer (got '${index.type}').`);
    }

    // Array index
    if (object.type === "array") {
      const idx = index.value;
      if (idx < 0 || idx >= object.elements.length) {
        throw this.error(node, `Index ${idx} out of bounds for array of length ${object.elements.length}.`);
      }
      return object.elements[idx];
    }

    // Pointer index (offset read)
    if (object.type === "pointer") {
      try {
        return this.memory.read(object.address, index.value);
      } catch (e: any) {
        throw this.error(node, e.message);
      }
    }

    throw this.error(node, `Cannot index into a '${object.type}' value.`);
  }

  private visitStructLiteral(node: StructLiteral): VKSValue {
    const structDef = this.structDefs.get(node.name);
    if (!structDef) {
      throw this.error(node, `Unknown struct type '${node.name}'.`);
    }

    const fields = new Map<string, VKSValue>();
    for (const field of node.fields) {
      fields.set(field.name.name, this.visitExpression(field.value));
    }

    return mkStruct(node.name, fields);
  }

  private visitCastExpr(node: CastExpr): VKSValue {
    const value = this.visitExpression(node.expr);
    const targetTypeName = this.getTypeName(node.targetType);

    // Integer → Float
    if (value.type === "integer" && (targetTypeName === "f32" || targetTypeName === "f64")) {
      const bitWidth = targetTypeName === "f32" ? 32 : 64;
      return mkFloat(value.value, bitWidth as 32 | 64);
    }

    // Float → Integer
    if (value.type === "float" && (targetTypeName === "i8" || targetTypeName === "i16" || targetTypeName === "i32" || targetTypeName === "i64")) {
      const bitWidth = parseInt(targetTypeName.slice(1)) as 8 | 16 | 32 | 64;
      return mkInteger(Math.trunc(value.value), bitWidth);
    }

    // Float → Float (precision change)
    if (value.type === "float" && (targetTypeName === "f32" || targetTypeName === "f64")) {
      const bitWidth = targetTypeName === "f32" ? 32 : 64;
      return mkFloat(value.value, bitWidth as 32 | 64);
    }

    // Integer → Integer (width change)
    if (value.type === "integer" && (targetTypeName === "i8" || targetTypeName === "i16" || targetTypeName === "i32" || targetTypeName === "i64")) {
      const bitWidth = parseInt(targetTypeName.slice(1)) as 8 | 16 | 32 | 64;
      return mkInteger(value.value, bitWidth);
    }

    // Integer → Byte
    if (value.type === "integer" && targetTypeName === "byte") {
      return mkByte(value.value);
    }

    // Byte → Integer
    if (value.type === "byte" && (targetTypeName === "i8" || targetTypeName === "i16" || targetTypeName === "i32" || targetTypeName === "i64")) {
      const bitWidth = parseInt(targetTypeName.slice(1)) as 8 | 16 | 32 | 64;
      return mkInteger(value.value, bitWidth);
    }

    throw this.error(node, `Cannot cast '${value.type}' to '${targetTypeName}'.`);
  }

  private visitAllocExpr(node: AllocExpr): VKSValue {
    const size = this.visitExpression(node.sizeExpr);
    if (size.type !== "integer") {
      throw this.error(node, `alloc() size must be an integer (got '${size.type}').`);
    }
    try {
      const address = this.memory.alloc(size.value);
      return mkPointer(address);
    } catch (e: any) {
      throw this.error(node, e.message);
    }
  }

  private visitCloneExpr(node: CloneExpr): VKSValue {
    const value = this.visitExpression(node.expr);
    return deepClone(value);
  }

  private visitArrayLiteral(node: ArrayLiteral): VKSValue {
    const elements = node.elements.map(e => this.visitExpression(e));
    return mkArray(elements);
  }

  private visitAssignmentExpr(node: AssignmentExpr): VKSValue {
    const value = this.visitExpression(node.value);

    // Simple variable assignment: x = 10
    if (node.target.kind === "Identifier") {
      try {
        this.currentEnv.set(node.target.name, value);
      } catch (e: any) {
        throw this.error(node, e.message);
      }
      return value;
    }

    // Field assignment: p.name = "Vektor"
    if (node.target.kind === "FieldAccessExpr") {
      const object = this.visitExpression(node.target.object);
      if (object.type !== "struct") {
        throw this.error(node, `Cannot assign to field on a '${object.type}' value.`);
      }
      const fieldName = node.target.field.name;
      if (!object.fields.has(fieldName)) {
        throw this.error(node, `Struct '${object.structName}' has no field '${fieldName}'.`);
      }
      object.fields.set(fieldName, value);
      return value;
    }

    // Index assignment: scores[0] = 100 or buffer[0] = 'V'
    if (node.target.kind === "IndexAccessExpr") {
      const object = this.visitExpression(node.target.object);
      const index = this.visitExpression(node.target.index);

      if (index.type !== "integer") {
        throw this.error(node, `Index must be an integer (got '${index.type}').`);
      }

      // Array index assignment
      if (object.type === "array") {
        const idx = index.value;
        if (idx < 0 || idx >= object.elements.length) {
          throw this.error(node, `Index ${idx} out of bounds for array of length ${object.elements.length}.`);
        }
        object.elements[idx] = value;
        return value;
      }

      // Pointer index assignment
      if (object.type === "pointer") {
        try {
          this.memory.write(object.address, index.value, value);
        } catch (e: any) {
          throw this.error(node, e.message);
        }
        return value;
      }

      throw this.error(node, `Cannot index-assign into a '${object.type}' value.`);
    }

    throw this.error(node, "Invalid assignment target.");
  }

  // ── Helpers ──────────────────────────────────────────────

  private getTypeName(typeNode: TypeNode): string {
    if (typeNode.kind === "PrimitiveType") {
      return typeNode.name;
    }
    return typeNode.kind;
  }

  private defaultForType(typeNode: TypeNode): VKSValue {
    if (typeNode.kind === "PrimitiveType") {
      switch (typeNode.name) {
        case "i8": return mkInteger(0, 8);
        case "i16": return mkInteger(0, 16);
        case "i32": return mkInteger(0, 32);
        case "i64": return mkInteger(0, 64);
        case "f32": return mkFloat(0, 32);
        case "f64": return mkFloat(0, 64);
        case "bool": return mkBool(false);
        case "byte": return mkByte(0);
        case "str": return mkString("");
        case "void": return mkVoid();
      }
    }
    if (typeNode.kind === "NullableType") {
      return mkNull();
    }
    return mkNull();
  }

  private error(node: ASTNode, message: string): RuntimeError {
    return new RuntimeError(node.line, node.column, message);
  }
}
