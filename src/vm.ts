// ============================================================
// Vektor — Virtual Machine
// ============================================================
// Executes compiled Vektor bytecode.
// Features a flat operand stack, call frames for functions,
// a simple heap for dynamic allocations, and a fast loop.
// ============================================================

import { Op } from "./opcodes.js";
import { CompiledProgram, CompiledFunction, ConstantType, Chunk } from "./chunk.js";
import { RuntimeError } from "./errors.js";
import { registerVMBuiltins } from "./stdlib.js";

// ── Call Frame ───────────────────────────────────────────────

class CallFrame {
  /** The function being executed */
  public readonly fn: CompiledFunction;
  /** Current instruction pointer within fn.chunk */
  public ip: number;
  /** The index in the stack where this frame's locals begin */
  public readonly basePointer: number;

  constructor(fn: CompiledFunction, basePointer: number) {
    this.fn = fn;
    this.ip = 0;
    this.basePointer = basePointer;
  }
}

// ── Memory / Structs ─────────────────────────────────────────

export class VMStruct {
  public name: string;
  public fields: Map<string, any> = new Map();

  constructor(name: string) {
    this.name = name;
  }
}

export class VMResult {
  constructor(public isOk: boolean, public value: any, public error: any) {}
  get ok() { return this.isOk; }
}

export class VMPointer {
  constructor(public address: number) {}
}

export class VMNativeFunction {
  constructor(public name: string, public arity: number, public fn: (...args: any[]) => any) {}
}

/** Byte buffer stored at a heap allocation address. */
interface VMHeapBlock {
  size: number;
  data: any[];
}

function isHeapBlock(val: unknown): val is VMHeapBlock {
  return (
    typeof val === "object" &&
    val !== null &&
    "data" in val &&
    Array.isArray((val as VMHeapBlock).data)
  );
}

// ── Virtual Machine ──────────────────────────────────────────

export class VM {
  private stack: any[] = [];
  private frames: CallFrame[] = [];
  private globals: Map<string, any> = new Map();
  private program: CompiledProgram | null = null;
  public lastPopped: any = undefined;

  // Heap memory for explicit allocations (alloc/free) and pointer deref
  private heap: Map<number, any> = new Map();
  private nextPtr: number = 1000;

  // Debug options
  public traceExecution: boolean = false;
  private instructionsExecuted: number = 0;

  /**
   * Run a completely compiled program.
   */
  run(program: CompiledProgram): void {
    this.program = program;
    this.stack = [];
    this.frames = [];
    this.globals.clear();
    this.heap.clear();
    
    this.registerBuiltins();

    // The entry point is the <script> chunk, which initializes globals
    // and then calls the main function.
    const scriptFn = program.functions.find(f => f.name === "<script>");
    if (!scriptFn) {
      throw new Error("VM Error: No <script> entry point found in CompiledProgram.");
    }

    this.frames.push(new CallFrame(scriptFn, 0));

    this.executeLoop();
  }

  // ── Dispatch Loop ──────────────────────────────────────────

  private executeLoop(): void {
    let frame = this.frames[this.frames.length - 1];
    let chunk = frame.fn.chunk;
    let code = chunk.code;

    try {
      while (true) {
        this.instructionsExecuted++;
        if (this.instructionsExecuted > 500000000) {
            throw new Error(`VM Infinite Loop Detected! ip: ${frame.ip}, op: ${code[frame.ip]}`);
        }
      
      if (frame.ip >= code.length) {
        throw new RuntimeError("VM executed past end of chunk", chunk.lines[chunk.lines.length - 1] || 1);
      }
      try {
        const instruction = code[frame.ip];
        if (frame.fn.chunk.sourceFiles && frame.fn.chunk.sourceFiles.length > 0) {
          // console.log(`[IP:${frame.ip}] OP: ${instruction}`);
        }
        frame.ip++;
      } catch (e) {}

      const op = code[frame.ip - 1] as Op;
      const line = chunk.lines[frame.ip - 1];

      if (this.traceExecution) {
        this.printTrace(frame, op);
      }

      switch (op) {
        // ── Constants & Literals
        case Op.CONST: {
          const idx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const constant = chunk.constants[idx];
          if (constant.type === ConstantType.FUNCTION) {
            this.push(constant); // Push the raw constant reference for functions
          } else {
            this.push(constant.value);
          }
          break;
        }
        case Op.NULL: this.push(null); break;
        case Op.TRUE: this.push(true); break;
        case Op.FALSE: this.push(false); break;

        // ── Arithmetic
        case Op.ADD: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a === "string" || typeof b === "string") {
            this.push(String(a) + String(b));
          } else if (typeof a === "number" && typeof b === "number") {
            this.push(a + b);
          } else {
            throw new RuntimeError(`Cannot ADD ${typeof a} and ${typeof b}`, line);
          }
          break;
        }
        case Op.SUB: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== "number" || typeof b !== "number") throw new RuntimeError("Operands must be numbers", line);
          this.push(a - b);
          break;
        }
        case Op.MUL: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== "number" || typeof b !== "number") throw new RuntimeError("Operands must be numbers", line);
          this.push(a * b);
          break;
        }
        case Op.DIV: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== "number" || typeof b !== "number") throw new RuntimeError("Operands must be numbers", line);
          if (b === 0) throw new RuntimeError("Division by zero", line);
          this.push(a / b);
          break;
        }
        case Op.MOD: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== "number" || typeof b !== "number") throw new RuntimeError("Operands must be numbers", line);
          this.push(a % b);
          break;
        }
        case Op.NEG: {
          const a = this.pop();
          if (typeof a !== "number") throw new RuntimeError("Operand must be a number", line);
          this.push(-a);
          break;
        }

        // ── Comparison
        case Op.EQ: {
          const b = this.pop();
          const a = this.pop();
          this.push(a === b);
          break;
        }
        case Op.NEQ: {
          const b = this.pop();
          const a = this.pop();
          this.push(a !== b);
          break;
        }
        case Op.LT: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== typeof b || (typeof a !== "number" && typeof a !== "string")) throw new RuntimeError("Operands must be numbers or strings", line);
          this.push(a < b);
          break;
        }
        case Op.GT: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== typeof b || (typeof a !== "number" && typeof a !== "string")) throw new RuntimeError("Operands must be numbers or strings", line);
          this.push(a > b);
          break;
        }
        case Op.LTE: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== typeof b || (typeof a !== "number" && typeof a !== "string")) throw new RuntimeError("Operands must be numbers or strings", line);
          this.push(a <= b);
          break;
        }
        case Op.GTE: {
          const b = this.pop();
          const a = this.pop();
          if (typeof a !== typeof b || (typeof a !== "number" && typeof a !== "string")) throw new RuntimeError("Operands must be numbers or strings", line);
          this.push(a >= b);
          break;
        }
        case Op.NOT: {
          const a = this.pop();
          this.push(!this.isTruthy(a));
          break;
        }

        // ── Variables
        case Op.LOAD_LOCAL: {
          const slot = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          this.push(this.stack[frame.basePointer + slot]);
          break;
        }
        case Op.STORE_LOCAL: {
          const slot = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          this.stack[frame.basePointer + slot] = this.peek(); // Store but don't pop (assignment returns value)
          break;
        }
        case Op.LOAD_GLOBAL: {
          const idx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const name = chunk.constants[idx].value as string;
          if (!this.globals.has(name)) {
            throw new RuntimeError(`Undefined global '${name}'`, line);
          }
          this.push(this.globals.get(name));
          break;
        }
        case Op.STORE_GLOBAL: {
          const idx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const name = chunk.constants[idx].value as string;
          this.globals.set(name, this.pop());
          break;
        }

        // ── Control Flow
        case Op.JUMP: {
          const offset = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2 + offset;
          break;
        }
        case Op.JUMP_IF_FALSE: {
          const offset = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const condition = this.pop();
          if (!this.isTruthy(condition)) {
            frame.ip += offset;
          }
          break;
        }
        case Op.JUMP_IF_TRUE: {
          const offset = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const condition = this.pop();
          if (this.isTruthy(condition)) {
            frame.ip += offset;
          }
          break;
        }
        case Op.LOOP: {
          const offset = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          frame.ip -= offset;
          break;
        }

        // ── Functions
        case Op.CALL: {
          const argCount = code[frame.ip];
          frame.ip += 1;
          const callee = this.stack[this.stack.length - 1 - argCount];
          
          if (callee instanceof VMNativeFunction) {
            // Extract arguments
            const args = [];
            for (let i = 0; i < argCount; i++) {
              args.push(this.pop());
            }
            args.reverse();
            // Pop the native function itself
            this.pop();
            
            // Call native JS function
            const result = callee.fn(...args);
            this.push(result === undefined ? null : result);
            break;
          }

          if (!callee || callee.type !== ConstantType.FUNCTION) {
             throw new RuntimeError("Attempted to call a non-function value.", line);
          }

          const targetFn = this.program!.functions[callee.functionIndex];
          if (argCount !== targetFn.arity) {
             throw new RuntimeError(`Expected ${targetFn.arity} arguments but got ${argCount}.`, line);
          }

          // The base pointer for the new frame is exactly where the first argument is.
          // The callee object itself is right before the arguments.
          const basePointer = this.stack.length - argCount;
          
          if (this.frames.length >= 10000) {
             throw new RuntimeError("Maximum call stack size exceeded (Stack overflow).", line);
          }

          this.frames.push(new CallFrame(targetFn, basePointer));
          
          // Update local loop variables for the new frame
          frame = this.frames[this.frames.length - 1];
          chunk = frame.fn.chunk;
          code = chunk.code;
          break;
        }
        case Op.RETURN: {
          const result = this.pop();
          // Pop frame
          const poppedFrame = this.frames.pop();
          if (this.frames.length === 0) {
            return; // Exit script
          }
          // Pop arguments and callee from stack
          // callee is at basePointer - 1
          this.stack.length = poppedFrame!.basePointer - 1;
          this.push(result); // push return value
          
          // Restore execution context
          frame = this.frames[this.frames.length - 1];
          chunk = frame.fn.chunk;
          code = chunk.code;
          break;
        }

        // ── Stack
        case Op.POP: {
          this.lastPopped = this.pop();
          break;
        }
        case Op.DUP: {
          this.push(this.peek());
          break;
        }

        // ── Structs & Arrays
        case Op.NEW_STRUCT: {
          const nameIdx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const structName = chunk.constants[nameIdx].value as string;
          const fieldCount = code[frame.ip++];
          
          const structObj = new VMStruct(structName);
          
          // Read field names
          const fieldNames: string[] = [];
          for (let i = 0; i < fieldCount; i++) {
            const fieldIdx = (code[frame.ip] << 8) | code[frame.ip + 1];
            frame.ip += 2;
            fieldNames.push(chunk.constants[fieldIdx].value as string);
          }

          // Pop values in reverse order (since last argument pushed is on top)
          const fieldValues: any[] = [];
          for (let i = 0; i < fieldCount; i++) {
            fieldValues.push(this.pop());
          }
          fieldValues.reverse();

          for (let i = 0; i < fieldCount; i++) {
            structObj.fields.set(fieldNames[i], fieldValues[i]);
          }

          this.push(structObj);
          break;
        }
        case Op.GET_FIELD: {
          const nameIdx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const fieldName = chunk.constants[nameIdx].value as string;
          const obj = this.pop();
          
          if (obj instanceof VMStruct) {
            if (!obj.fields.has(fieldName)) {
              throw new RuntimeError(`Struct '${obj.name}' has no field '${fieldName}'`, line);
            }
            this.push(obj.fields.get(fieldName));
          } else if (obj instanceof VMResult) {
            if (fieldName === "ok") this.push(obj.ok);
            else if (fieldName === "value") this.push(obj.value);
            else if (fieldName === "error") this.push(obj.error);
            else throw new RuntimeError(`Result has no field '${fieldName}'`, line);
          } else if (Array.isArray(obj)) {
            if (fieldName === "len") this.push(obj.length);
            else throw new RuntimeError(`Array has no field '${fieldName}'`, line);
          } else if (typeof obj === "string") {
            if (fieldName === "len") this.push(obj.length);
            else throw new RuntimeError(`String has no field '${fieldName}'`, line);
          } else {
            throw new RuntimeError(`Cannot access field '${fieldName}' on non-object`, line);
          }
          break;
        }
        case Op.SET_FIELD: {
          const fieldIndex = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const value = this.pop();
          const obj = this.pop();

          if (obj instanceof VMStruct) {
            const fieldName = chunk.constants[fieldIndex].value as string;
            obj.fields.set(fieldName, value);
            this.push(value); // Keep value on stack for chained assignments (or pop later)
          } else {
            throw new Error(`RuntimeError: Attempt to set field on non-struct.`);
          }
          break;
        }
        case Op.NEW_ARRAY: {
          const count = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const arr: any[] = [];
          for (let i = 0; i < count; i++) {
            arr.push(this.pop());
          }
          arr.reverse();
          this.push(arr);
          break;
        }
        case Op.GET_INDEX: {
          const idx = this.pop();
          const obj = this.pop();
          if (Array.isArray(obj)) {
            if (typeof idx !== "number" || idx < 0 || idx >= obj.length) {
              throw new RuntimeError("Index out of bounds", line);
            }
            this.push(obj[idx]);
          } else if (obj instanceof VMPointer) {
            this.push(this.readPointerIndex(obj, idx, line));
          } else {
            throw new RuntimeError("Cannot index non-array", line);
          }
          break;
        }
        case Op.SET_INDEX: {
          const value = this.pop();
          const idx = this.pop();
          const obj = this.pop();

          if (Array.isArray(obj)) {
            if (typeof idx !== "number" || idx < 0 || idx >= obj.length) {
              throw new RuntimeError("Index out of bounds", line);
            }
            obj[idx] = value;
            this.push(value);
          } else if (obj instanceof VMPointer) {
            this.writePointerIndex(obj, idx, value, line);
            this.push(value);
          } else {
            throw new RuntimeError("Cannot index non-array", line);
          }
          break;
        }

        // ── Special & Memory
        case Op.MAKE_OK: {
          this.push(new VMResult(true, this.pop(), null));
          break;
        }
        case Op.MAKE_ERR: {
          this.push(new VMResult(false, null, this.pop()));
          break;
        }
        case Op.ALLOC: {
          const size = this.pop();
          if (typeof size !== "number") throw new RuntimeError("Alloc size must be a number", line);
          const byteCount = Math.max(0, Math.trunc(size));
          const ptr = new VMPointer(this.nextPtr++);
          const data = new Array(byteCount).fill(0);
          this.heap.set(ptr.address, { size: byteCount, data } satisfies VMHeapBlock);
          this.push(ptr);
          break;
        }
        case Op.FREE: {
          const ptr = this.pop();
          if (!(ptr instanceof VMPointer)) throw new RuntimeError("Free requires a pointer", line);
          this.heap.delete(ptr.address);
          this.push(null);
          break;
        }
        case Op.ADDR_OF: {
          // Creates a pointer to a stack local variable.
          // Because we use a JS array, we can't truly pass a raw memory address to the stack.
          // To simulate this securely, we store the stack index as a negative pointer.
          const slot = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const absoluteIndex = frame.basePointer + slot;
          this.push(new VMPointer(-absoluteIndex));
          break;
        }
        case Op.DEREF: {
          const ptr = this.pop();
          if (!(ptr instanceof VMPointer)) throw new RuntimeError("Cannot dereference a non-pointer", line);
          if (ptr.address < 0) {
            // Stack pointer
            this.push(this.stack[-ptr.address]);
          } else {
            // Heap pointer — deref reads the first slot
            if (!this.heap.has(ptr.address)) {
              throw new RuntimeError(`Dereferencing freed or invalid pointer (addr: ${ptr.address})`, line);
            }
            const block = this.heap.get(ptr.address);
            if (isHeapBlock(block)) {
              this.push(block.data[0] ?? 0);
            } else {
              this.push(block);
            }
          }
          break;
        }
        case Op.DEREF_SET: {
           const val = this.pop();
           const ptr = this.pop();
           
           if (!(ptr instanceof VMPointer)) {
             throw new RuntimeError("Cannot dereference non-pointer for assignment.", line);
           }
           
           if (ptr.address <= 0) {
             // Stack pointer
             this.stack[-ptr.address] = val;
           } else {
             // Heap pointer
             if (!this.heap.has(ptr.address)) {
               throw new RuntimeError(`Dereferencing freed or invalid pointer (addr: ${ptr.address})`, line);
             }
             const block = this.heap.get(ptr.address);
             if (isHeapBlock(block)) {
               block.data[0] = val;
             } else {
               this.heap.set(ptr.address, val);
             }
           }
           this.push(val); // Assignment expressions evaluate to the assigned value
           break;
        }
        case Op.CAST: {
          const typeIdx = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const typeName = chunk.constants[typeIdx].value as string;
          const value = this.pop();
          
          if (typeName === "f64" || typeName === "i32") {
             this.push(Number(value));
          } else if (typeName === "str") {
             this.push(String(value));
          } else if (typeName === "byte") {
             if (typeof value === "string") this.push(value.charCodeAt(0));
             else this.push(Number(value) & 0xFF);
          } else {
             this.push(value); // no-op for structs
          }
          break;
        }
        case Op.CLONE: {
          const obj = this.pop();
          if (obj instanceof VMStruct) {
            const clone = new VMStruct(obj.name);
            for (const [k, v] of obj.fields.entries()) {
              clone.fields.set(k, v); // Shallow clone matching AST interpreter
            }
            this.push(clone);
          } else if (Array.isArray(obj)) {
            this.push([...obj]);
          } else {
            this.push(obj); // Primitive
          }
          break;
        }

        case Op.INC: {
          const slot = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const val = this.stack[frame.basePointer + slot];
          if (typeof val !== "number") throw new RuntimeError("Cannot apply '++' to non-number", line);
          this.stack[frame.basePointer + slot] = val + 1;
          this.push(val); // Postfix returns old value
          break;
        }
        case Op.DEC: {
          const slot = (code[frame.ip] << 8) | code[frame.ip + 1];
          frame.ip += 2;
          const val = this.stack[frame.basePointer + slot];
          if (typeof val !== "number") throw new RuntimeError("Cannot apply '--' to non-number", line);
          this.stack[frame.basePointer + slot] = val - 1;
          this.push(val); // Postfix returns old value
          break;
        }

        case Op.HALT: {
          return;
        }

        default:
          throw new Error(`VM: Unknown opcode ${op} at ip ${frame.ip - 1}`);
      }
    }
    } catch (e: any) {
      if (e instanceof RuntimeError || (e instanceof Error && e.name === "RuntimeError")) {
        e.vmTrace = [];
        for (let i = this.frames.length - 1; i >= 0; i--) {
          const f = this.frames[i];
          const l = f.fn.chunk.lines[f.ip - 1] || "?";
          e.vmTrace.push(`  at ${f.fn.name} (line ${l})`);
        }
      }
      throw e;
    }
  }

  // ── Built-in Functions ───────────────────────────────────

  private readPointerIndex(ptr: VMPointer, idx: unknown, line: number): any {
    if (typeof idx !== "number") throw new RuntimeError("Pointer index must be a number", line);
    if (ptr.address < 0) {
      const slot = -ptr.address + Math.trunc(idx);
      if (slot < 0 || slot >= this.stack.length) throw new RuntimeError("Index out of bounds", line);
      return this.stack[slot];
    }
    const block = this.heap.get(ptr.address);
    if (!isHeapBlock(block)) throw new RuntimeError("Invalid or freed heap pointer", line);
    const i = Math.trunc(idx);
    if (i < 0 || i >= block.size) throw new RuntimeError("Index out of bounds", line);
    return block.data[i];
  }

  private writePointerIndex(ptr: VMPointer, idx: unknown, value: any, line: number): void {
    if (typeof idx !== "number") throw new RuntimeError("Pointer index must be a number", line);
    if (ptr.address < 0) {
      const slot = -ptr.address + Math.trunc(idx);
      if (slot < 0 || slot >= this.stack.length) throw new RuntimeError("Index out of bounds", line);
      this.stack[slot] = value;
      return;
    }
    const block = this.heap.get(ptr.address);
    if (!isHeapBlock(block)) throw new RuntimeError("Invalid or freed heap pointer", line);
    const i = Math.trunc(idx);
    if (i < 0 || i >= block.size) throw new RuntimeError("Index out of bounds", line);
    block.data[i] = value;
  }

  private registerBuiltins(): void {
    registerVMBuiltins(
      (name, arity, fn) => {
        this.globals.set(name, new VMNativeFunction(name, arity, fn));
      },
      { formatValue: (val) => this.stringify(val) },
    );
    
    // Register missing builtins that the TS compiler used to emit via dedicated opcodes
    this.globals.set("Ok", new VMNativeFunction("Ok", 1, (val) => new VMResult(true, val, null)));
    this.globals.set("Err", new VMNativeFunction("Err", 1, (val) => new VMResult(false, null, val)));
    
    this.globals.set("alloc", new VMNativeFunction("alloc", 1, (size) => {
      if (typeof size !== "number") throw new RuntimeError("Alloc size must be a number", -1);
      const byteCount = Math.max(0, Math.trunc(size));
      const ptr = new VMPointer(this.nextPtr++);
      const data = new Array(byteCount).fill(0);
      this.heap.set(ptr.address, { size: byteCount, data } as any);
      return ptr;
    }));
    
    this.globals.set("free", new VMNativeFunction("free", 1, (ptr) => {
      if (ptr instanceof VMPointer && ptr.address >= 0) {
        this.heap.delete(ptr.address);
      }
      return null;
    }));
  }

  // ── Helpers ────────────────────────────────────────────────

  private push(value: any): void {
    this.stack.push(value);
  }

  private pop(): any {
    if (this.stack.length === 0) {
       throw new Error("VM Stack Underflow");
    }
    return this.stack.pop();
  }

  private peek(distance: number = 0): any {
    return this.stack[this.stack.length - 1 - distance];
  }

  private isTruthy(val: any): boolean {
    if (val === null || val === false) return false;
    if (val === 0) return false;
    if (val === "") return false;
    return true;
  }

  private stringify(val: any): string {
    if (val === null) return "null";
    if (val instanceof Map) {
      const entries = Array.from(val.entries())
        .map(([k, v]) => `"${k}": ${this.stringify(v)}`)
        .join(", ");
      return `map { ${entries} }`;
    }
    if (val instanceof VMStruct) {
      let str = `${val.name} { `;
      const entries = Array.from(val.fields.entries());
      str += entries.map(([k, v]) => `${k}: ${this.stringify(v)}`).join(", ");
      return str + " }";
    }
    if (val instanceof VMResult) {
      return val.isOk ? `Ok(${this.stringify(val.value)})` : `Err(${this.stringify(val.error)})`;
    }
    if (val instanceof VMPointer) {
      return `ptr<0x${val.address.toString(16)}>`;
    }
    if (Array.isArray(val)) {
      return `[${val.map(v => this.stringify(v)).join(", ")}]`;
    }
    return String(val);
  }

  private printTrace(frame: CallFrame, op: Op): void {
    let stackStr = "[";
    for (const v of this.stack) {
       let sv = this.stringify(v);
       if (sv.length > 15) sv = sv.substring(0, 15) + "...";
       stackStr += sv + ", ";
    }
    if (this.stack.length > 0) stackStr = stackStr.substring(0, stackStr.length - 2);
    stackStr += "]";
    console.log(`  ip: ${frame.ip.toString().padStart(4, "0")}  op: 0x${op.toString(16).padStart(2, "0")}  stack: ${stackStr}`);
  }
}
