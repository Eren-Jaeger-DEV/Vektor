const fs = require('fs');

let ts = fs.readFileSync('f:\\projects\\VKS\\src\\llvm-emitter.ts', 'utf8');

// The VKS file starts at `function vks_type_to_llvm`
let vks = `import "ast.vks";

// ============================================================
// LLVM Emitter - Batch 1 & 2
// ============================================================

// ── Type mapping ────────────────────────────────────────────
`;

// Extract from `export function vksTypeToLLVM` down to the end
let startIdx = ts.indexOf('export function vksTypeToLLVM');
let code = ts.substring(startIdx);

// Perform standard replacements
code = code.replace(/export function/g, 'function');
code = code.replace(/export class/g, 'class');
code = code.replace(/const /g, 'let ');
code = code.replace(/===/g, '==');
code = code.replace(/!==/g, '!=');
code = code.replace(/\|\|/g, 'or');
code = code.replace(/&&/g, 'and');
code = code.replace(/ string/g, ' str');
code = code.replace(/: string/g, ': str');
code = code.replace(/boolean/g, 'bool');
code = code.replace(/number/g, 'i32'); // approximate
code = code.replace(/console\.log/g, 'print');

// Since writing a perfect regex transpiler in 1 minute is impossible,
// I'll just write the EXACT patches needed to make StructLiteral work!
