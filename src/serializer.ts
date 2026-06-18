import { Chunk, ConstantType, CompiledProgram, CompiledFunction } from "./chunk.js";

const MAGIC = "VKB\0";
const VERSION = 1;

class BufferReader {
  constructor(public buf: Buffer, public offset = 0) {}

  readUInt8() { const v = this.buf.readUInt8(this.offset); this.offset += 1; return v; }
  readUInt16BE() { const v = this.buf.readUInt16BE(this.offset); this.offset += 2; return v; }
  readUInt32BE() { const v = this.buf.readUInt32BE(this.offset); this.offset += 4; return v; }
  readInt32BE() { const v = this.buf.readInt32BE(this.offset); this.offset += 4; return v; }
  readDoubleBE() { const v = this.buf.readDoubleBE(this.offset); this.offset += 8; return v; }
  
  readStringRaw(len: number) { 
    const s = this.buf.toString("utf-8", this.offset, this.offset + len); 
    this.offset += len; 
    return s; 
  }
}

export class Serializer {
  deserialize(buffer: Buffer): CompiledProgram {
    const reader = new BufferReader(buffer);
    
    const magic = reader.readStringRaw(4);
    if (magic !== MAGIC) throw new Error("Invalid format: not a VKB file (magic bytes mismatch).");
    
    const version = reader.readUInt16BE();
    if (version !== VERSION) throw new Error(`Unsupported VKB version: ${version} (expected ${VERSION}).`);

    const structsCount = reader.readUInt16BE();
    for (let i = 0; i < structsCount; i++) {
        // VKS doesn't natively serialize structs yet, but we read the empty count (0)
    }

    const functionsCount = reader.readUInt16BE();
    const functions: CompiledFunction[] = [];
    
    for (let i = 0; i < functionsCount; i++) {
      const nameLen = reader.readUInt16BE();
      const name = reader.readStringRaw(nameLen);
      const arity = reader.readUInt8();
      
      const chunk = new Chunk(name);
      
      const constCount = reader.readUInt16BE();
      for (let j = 0; j < constCount; j++) {
        const type = reader.readUInt8();
        if (type === ConstantType.INT) {
          chunk.constants.push({ type, value: reader.readInt32BE() });
        } else if (type === ConstantType.FLOAT) {
          chunk.constants.push({ type, value: reader.readDoubleBE() });
        } else if (type === ConstantType.STRING) {
          const sLen = reader.readUInt16BE();
          chunk.constants.push({ type, value: reader.readStringRaw(sLen) });
        } else if (type === ConstantType.BYTE) {
          chunk.constants.push({ type, value: reader.readUInt8() });
        } else if (type === ConstantType.FUNCTION) {
          chunk.constants.push({ type, functionIndex: reader.readUInt16BE() });
        } else {
          throw new Error(`Unknown constant type: ${type}`);
        }
      }

      const codeCount = reader.readUInt32BE();
      for (let j = 0; j < codeCount; j++) {
        chunk.code.push(reader.readUInt8());
      }

      const rleIntCount = reader.readUInt32BE();
      const rlePairsCount = Math.floor(rleIntCount / 2);
      for (let j = 0; j < rlePairsCount; j++) {
        const count = reader.readUInt32BE();
        const line = reader.readUInt32BE();
        for (let k = 0; k < count; k++) {
          chunk.lines.push(line);
        }
      }

      functions.push({ name, arity, chunk });
    }

    const entryLen = reader.readUInt16BE();
    const entryPoint = reader.readStringRaw(entryLen);

    return { structs: [], functions, entryPoint };
  }
}
