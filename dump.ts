import { readFileSync, writeFileSync } from 'fs';
import { Serializer } from './src/serializer.js';
import { Disassembler } from './src/disassembler.js';
import { CompiledProgram } from './src/chunk.js';

const p = new Serializer().deserialize(readFileSync('vks-compiled-output.vkb'));
const d = new Disassembler();
// override line to capture output
let out = "";
d['line'] = (str: string) => { out += str + "\n"; };
d.disassembleProgram(p);
writeFileSync('disassembly.txt', out);
