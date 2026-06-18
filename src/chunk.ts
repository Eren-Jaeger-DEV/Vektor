// ============================================================
// Viktor Script — Bytecode Chunk
// ============================================================
// A Chunk is the compiled bytecode for a single function (or
// the top-level script). It holds the instruction bytes, a
// constant pool, and source line mappings for error reporting.
// ============================================================

// ── Constant Pool Values ─────────────────────────────────────

export enum ConstantType {
  INT    = 0,
  FLOAT  = 1,
  STRING = 2,
  BYTE   = 3,
  FUNCTION = 4,
}

export interface IntConstant {
  type: ConstantType.INT;
  value: number;
}

export interface FloatConstant {
  type: ConstantType.FLOAT;
  value: number;
}

export interface StringConstant {
  type: ConstantType.STRING;
  value: string;
}

export interface ByteConstant {
  type: ConstantType.BYTE;
  value: number;
}

export interface FunctionConstant {
  type: ConstantType.FUNCTION;
  /** Index into CompiledProgram.functions */
  functionIndex: number;
}

export type ConstantValue =
  | IntConstant
  | FloatConstant
  | StringConstant
  | ByteConstant
  | FunctionConstant;

// ── Chunk ────────────────────────────────────────────────────

/**
 * A compiled bytecode chunk — one per function + one for the script.
 */
export class Chunk {
  /** The raw bytecode bytes */
  code: number[] = [];
  /** Constant pool */
  constants: ConstantValue[] = [];
  /** Source line for each bytecode offset */
  lines: number[] = [];
  /** Name of this chunk */
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /** Write a single byte and its source line. */
  writeByte(byte: number, line: number): void {
    this.code.push(byte & 0xFF);
    this.lines.push(line);
  }

  /** Write a u16 (big-endian) and its source line. */
  writeU16(value: number, line: number): void {
    this.code.push((value >> 8) & 0xFF);
    this.lines.push(line);
    this.code.push(value & 0xFF);
    this.lines.push(line);
  }

  /**
   * Add a constant to the pool and return its index.
   * Deduplicates identical constants.
   */
  addConstant(constant: ConstantValue): number {
    // Check for duplicate
    for (let i = 0; i < this.constants.length; i++) {
      const existing = this.constants[i];
      if (existing.type === constant.type) {
        if (
          (constant.type === ConstantType.INT && existing.type === ConstantType.INT && existing.value === constant.value) ||
          (constant.type === ConstantType.FLOAT && existing.type === ConstantType.FLOAT && existing.value === constant.value) ||
          (constant.type === ConstantType.STRING && existing.type === ConstantType.STRING && existing.value === constant.value) ||
          (constant.type === ConstantType.BYTE && existing.type === ConstantType.BYTE && existing.value === constant.value) ||
          (constant.type === ConstantType.FUNCTION && existing.type === ConstantType.FUNCTION && existing.functionIndex === constant.functionIndex)
        ) {
          return i;
        }
      }
    }

    const index = this.constants.length;
    if (index > 0xFFFF) {
      throw new Error("Constant pool overflow: too many constants (max 65535).");
    }
    this.constants.push(constant);
    return index;
  }

  /** Read a u16 at the given offset (big-endian). */
  readU16(offset: number): number {
    return (this.code[offset] << 8) | this.code[offset + 1];
  }

  /** Patch a u16 at the given offset (big-endian). */
  patchU16(offset: number, value: number): void {
    this.code[offset] = (value >> 8) & 0xFF;
    this.code[offset + 1] = value & 0xFF;
  }

  /** Current bytecode length. */
  get length(): number {
    return this.code.length;
  }
}

// ── Compiled Function ────────────────────────────────────────

export interface CompiledFunction {
  /** Function name */
  name: string;
  /** Number of parameters */
  arity: number;
  /** The compiled bytecode chunk */
  chunk: Chunk;
}

// ── Compiled Struct ──────────────────────────────────────────

export interface CompiledStruct {
  /** Struct name */
  name: string;
  /** Ordered field names */
  fields: string[];
}

// ── Compiled Program ─────────────────────────────────────────

/**
 * The complete compiled output — all functions, structs,
 * and the entry point reference.
 */
export interface CompiledProgram {
  /** All compiled functions (including main) */
  functions: CompiledFunction[];
  /** All struct definitions */
  structs: CompiledStruct[];
  /** The entry point function name (typically "main") */
  entryPoint: string;
}
