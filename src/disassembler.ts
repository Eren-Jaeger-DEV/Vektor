// ============================================================
// Vektor — Bytecode Disassembler
// ============================================================
// Produces human-readable output from compiled bytecode.
// Shows offset, opcode name, operands, and annotations.
// ============================================================

import { Op, OPCODE_INFO } from "./opcodes.js";
import {
  Chunk, ConstantType, ConstantValue,
  CompiledProgram, CompiledFunction,
} from "./chunk.js";

// ── Disassembler ─────────────────────────────────────────────

export class Disassembler {
  private output: string[] = [];

  /**
   * Disassemble an entire compiled program.
   */
  disassembleProgram(program: CompiledProgram): string {
    this.output = [];

    // Header
    this.line("╔══════════════════════════════════════════════════════════════╗");
    this.line("║  Vektor Bytecode Disassembly                        ║");
    this.line("╚══════════════════════════════════════════════════════════════╝");
    this.line("");

    // Struct definitions
    if (program.structs.length > 0) {
      this.line("── Struct Definitions ──────────────────────────────────────────");
      this.line("");
      for (const s of program.structs) {
        this.line(`  struct ${s.name} { ${s.fields.join(", ")} }`);
      }
      this.line("");
    }

    // Functions
    for (const fn of program.functions) {
      this.disassembleFunction(fn);
    }

    return this.output.join("\n");
  }

  /**
   * Disassemble a single function's bytecode.
   */
  disassembleFunction(fn: CompiledFunction): void {
    const label = fn.name === "<script>"
      ? `<script> (entry point)`
      : `${fn.name}(${fn.arity} params)`;

    this.line(`── Function: ${label} ${"─".repeat(Math.max(0, 47 - label.length))}`);
    this.line("");
    this.disassembleChunk(fn.chunk);
    this.line("");
  }

  /**
   * Disassemble a single chunk.
   */
  disassembleChunk(chunk: Chunk): void {
    let offset = 0;

    while (offset < chunk.code.length) {
      offset = this.disassembleInstruction(chunk, offset);
    }
  }

  /**
   * Disassemble one instruction at the given offset.
   * Returns the offset of the next instruction.
   */
  disassembleInstruction(chunk: Chunk, offset: number): number {
    const opcode = chunk.code[offset] as Op;
    const info = OPCODE_INFO.get(opcode);
    const line = chunk.lines[offset];

    // Offset column (4 digits, zero-padded)
    const offsetStr = offset.toString().padStart(4, "0");

    // Line info — show line number only when it changes
    const lineStr = (offset === 0 || line !== chunk.lines[offset - 1])
      ? line.toString().padStart(4, " ")
      : "   |";

    if (!info) {
      this.line(`  ${offsetStr}  ${lineStr}  ??? (0x${opcode.toString(16).padStart(2, "0")})`);
      return offset + 1;
    }

    // Build the instruction display
    let instr = info.name.padEnd(16, " ");
    let comment = "";
    let nextOffset = offset + 1;

    switch (opcode) {
      // 0 operands — nothing extra
      case Op.NULL:
      case Op.TRUE:
      case Op.FALSE:
      case Op.ADD:
      case Op.SUB:
      case Op.MUL:
      case Op.DIV:
      case Op.MOD:
      case Op.NEG:
      case Op.EQ:
      case Op.NEQ:
      case Op.LT:
      case Op.GT:
      case Op.LTE:
      case Op.GTE:
      case Op.NOT:
      case Op.GET_INDEX:
      case Op.SET_INDEX:
      case Op.ALLOC:
      case Op.FREE:
      case Op.DEREF:
      case Op.DEREF_SET:
      case Op.MAKE_OK:
      case Op.MAKE_ERR:
      case Op.CLONE:
      case Op.POP:
      case Op.DUP:
      case Op.RETURN:
      case Op.HALT:
        break;

      // u16 operand — constant index
      case Op.CONST: {
        const idx = chunk.readU16(offset + 1);
        instr += idx.toString().padStart(6, " ");
        comment = this.formatConstant(chunk.constants[idx]);
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — local slot
      case Op.LOAD_LOCAL:
      case Op.STORE_LOCAL:
      case Op.ADDR_OF:
      case Op.INC:
      case Op.DEC: {
        const slot = chunk.readU16(offset + 1);
        instr += slot.toString().padStart(6, " ");
        comment = `slot ${slot}`;
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — global name (constant pool index)
      case Op.LOAD_GLOBAL:
      case Op.STORE_GLOBAL: {
        const idx = chunk.readU16(offset + 1);
        instr += idx.toString().padStart(6, " ");
        comment = this.formatConstant(chunk.constants[idx]);
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — jump offset
      case Op.JUMP:
      case Op.JUMP_IF_FALSE:
      case Op.JUMP_IF_TRUE: {
        const jumpOffset = chunk.readU16(offset + 1);
        const target = offset + 3 + jumpOffset;
        instr += `+${jumpOffset}`.padStart(6, " ");
        comment = `→ ${target.toString().padStart(4, "0")}`;
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — loop offset (backward)
      case Op.LOOP: {
        const loopOffset = chunk.readU16(offset + 1);
        const target = offset + 3 - loopOffset;
        instr += `-${loopOffset}`.padStart(6, " ");
        comment = `→ ${target.toString().padStart(4, "0")}`;
        nextOffset = offset + 3;
        break;
      }

      // u8 operand — arg count
      case Op.CALL: {
        const argCount = chunk.code[offset + 1];
        instr += argCount.toString().padStart(6, " ");
        comment = `${argCount} arg(s)`;
        nextOffset = offset + 2;
        break;
      }

      case Op.PRINT: {
        const argCount = chunk.code[offset + 1];
        instr += argCount.toString().padStart(6, " ");
        comment = `${argCount} arg(s)`;
        nextOffset = offset + 2;
        break;
      }

      // NEW_STRUCT: u16 nameIdx, u8 fieldCount, then fieldCount × u16 fieldNameIdx
      case Op.NEW_STRUCT: {
        const nameIdx = chunk.readU16(offset + 1);
        const fieldCount = chunk.code[offset + 3];
        instr += `${nameIdx}, ${fieldCount}`.padStart(6, " ");
        comment = `${this.formatConstant(chunk.constants[nameIdx])} (${fieldCount} fields)`;
        nextOffset = offset + 4;
        // Skip field name indices
        const fieldNames: string[] = [];
        for (let i = 0; i < fieldCount; i++) {
          const fieldIdx = chunk.readU16(nextOffset);
          const c = chunk.constants[fieldIdx];
          if (c && c.type === ConstantType.STRING) {
            fieldNames.push(c.value);
          }
          nextOffset += 2;
        }
        if (fieldNames.length > 0) {
          comment += ` [${fieldNames.join(", ")}]`;
        }
        break;
      }

      // u16 operand — field name (constant pool index)
      case Op.GET_FIELD:
      case Op.SET_FIELD: {
        const idx = chunk.readU16(offset + 1);
        instr += idx.toString().padStart(6, " ");
        comment = `.${this.extractString(chunk.constants[idx])}`;
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — array count
      case Op.NEW_ARRAY: {
        const count = chunk.readU16(offset + 1);
        instr += count.toString().padStart(6, " ");
        comment = `${count} element(s)`;
        nextOffset = offset + 3;
        break;
      }

      // u16 operand — type name (constant pool index)
      case Op.CAST: {
        const idx = chunk.readU16(offset + 1);
        instr += idx.toString().padStart(6, " ");
        comment = `→ ${this.extractString(chunk.constants[idx])}`;
        nextOffset = offset + 3;
        break;
      }

      default: {
        // Fallback: skip known operand bytes
        nextOffset = offset + 1 + (info?.operandBytes ?? 0);
        break;
      }
    }

    // Format the output line
    const commentStr = comment ? `  ; ${comment}` : "";
    this.line(`  ${offsetStr}  ${lineStr}  ${instr}${commentStr}`);

    return nextOffset;
  }

  // ── Helpers ──────────────────────────────────────────────

  private formatConstant(c: ConstantValue | undefined): string {
    if (!c) return "???";
    switch (c.type) {
      case ConstantType.INT: return `${c.value} (i32)`;
      case ConstantType.FLOAT: return `${c.value} (f64)`;
      case ConstantType.STRING: return `"${c.value}"`;
      case ConstantType.BYTE: {
        const ch = String.fromCharCode(c.value);
        return `'${ch}' (${c.value})`;
      }
      case ConstantType.FUNCTION: return `<fn #${c.functionIndex}>`;
    }
  }

  private extractString(c: ConstantValue | undefined): string {
    if (c && c.type === ConstantType.STRING) return c.value;
    return "???";
  }

  private line(text: string): void {
    this.output.push(text);
  }
}
