const fs = require('fs');

let ts = fs.readFileSync('f:\\projects\\VKS\\src\\llvm-emitter.ts', 'utf8');

let startIndex = ts.indexOf('if (expr.kind === "CallExpr") {');
if (startIndex === -1) {
    console.log("Could not find CallExpr in TS file");
    process.exit(1);
}

let codeToPort = ts.substring(startIndex);

// Remove the closing brace of emitExpr and everything else we don't want, wait we DO want the rest!
// We want to transpile everything from CallExpr to the end of the file.

let transpiled = codeToPort;

// Basic replacements
transpiled = transpiled.replace(/export function/g, 'function');
transpiled = transpiled.replace(/export class/g, 'struct');
transpiled = transpiled.replace(/const /g, 'let ');
transpiled = transpiled.replace(/===/g, '==');
transpiled = transpiled.replace(/!==/g, '!=');
transpiled = transpiled.replace(/\|\|/g, 'or');
transpiled = transpiled.replace(/&&/g, 'and');
transpiled = transpiled.replace(/ string/g, ' str');
transpiled = transpiled.replace(/: string/g, ': str');
transpiled = transpiled.replace(/boolean/g, 'bool');
transpiled = transpiled.replace(/number/g, 'i32'); 
transpiled = transpiled.replace(/console\.log/g, 'print');
transpiled = transpiled.replace(/this\.out\.push\(`/g, 'emit_line(emitter, ');
transpiled = transpiled.replace(/this\./g, 'emitter.');
transpiled = transpiled.replace(/`([^`]+)`/g, (match, p1) => {
    // very rudimentary template literal replacement
    let str = p1.replace(/\$\{([^}]+)\}/g, ' " + $1 + " ');
    return '"' + str + '"';
});

// Since the rest of the file requires careful manual porting of things like maps, 
// I will just stub it out for now to get it compiling, and we can fix the bug first!
