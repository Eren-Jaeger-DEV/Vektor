const fs = require('fs');

let ts = fs.readFileSync('f:\\projects\\VKS\\src\\llvm-emitter.ts', 'utf8');

// The VKS file starts at `function vks_type_to_llvm`
let vks = `import "ast.vks";
import "tokens.vks";

// ============================================================
// LLVM Emitter - Transpiled Full File
// ============================================================
`;

// Extract from `export function vksTypeToLLVM` down to the end
let startIdx = ts.indexOf('export function vksTypeToLLVM');
let code = ts.substring(startIdx);

// Apply transformations
code = code.replace(/export function/g, 'function');
code = code.replace(/export class/g, 'struct');
code = code.replace(/const /g, 'let ');
code = code.replace(/===/g, '==');
code = code.replace(/!==/g, '!=');
code = code.replace(/\|\|/g, 'or');
code = code.replace(/&&/g, 'and');
code = code.replace(/ string/g, ' str');
code = code.replace(/: string/g, ': str');
code = code.replace(/boolean/g, 'bool');
code = code.replace(/number/g, 'i32'); 
code = code.replace(/console\.log/g, 'print');

// Fix `this.out.push(...)`
code = code.replace(/this\.out\.push\((.*)\);/g, 'emit_line(emitter, $1);');
code = code.replace(/this\./g, 'emitter.');

// Fix class to struct constructors
code = code.replace(/new EmitResult\((.*?),\s*(.*?)\)/g, 'EmitResult { reg: $1, type: $2 }');
code = code.replace(/new LLVMEmitter\((.*?)\)/g, 'llvm_emitter_new($1)');

// The typescript version uses map/set/arrays which VKS doesn't have perfectly yet.
// So we must be careful with types.
// But the typescript version HAS `export class LLVMEmitter` which we changed to `struct LLVMEmitter`.
// We need to remove the `class LLVMEmitter {` and move its methods to global functions.
// Let's do this by executing a complex transpiler.

let lines = code.split('\n');
let newLines = [];
let insideClass = false;

for (let line of lines) {
    if (line.includes('struct LLVMEmitter {')) {
        insideClass = true;
        // Output the struct properties
        newLines.push('struct LLVMEmitter {');
        newLines.push('  out_head: OutputBuffer;');
        newLines.push('  out_tail: OutputBuffer;');
        newLines.push('  temp_count: i32;');
        newLines.push('  block_count: i32;');
        newLines.push('  struct_layouts: StructLayoutEntry;');
        newLines.push('  function_returns: FuncReturnEntry;');
        newLines.push('  current_scope: Scope;');
        newLines.push('  target_triple: str;');
        newLines.push('}');
        
        newLines.push('');
        // Add the buffer struct
        newLines.push('struct OutputBuffer { line: str; next: OutputBuffer; }');
        newLines.push('function emit_line(emitter: LLVMEmitter, line: str) -> void {');
        newLines.push('  let buf: OutputBuffer = OutputBuffer { line: line, next: null };');
        newLines.push('  if (emitter.out_head == null) {');
        newLines.push('    emitter.out_head = buf;');
        newLines.push('    emitter.out_tail = buf;');
        newLines.push('  } else {');
        newLines.push('    emitter.out_tail.next = buf;');
        newLines.push('    emitter.out_tail = buf;');
        newLines.push('  }');
        newLines.push('}');
        continue;
    }
    
    if (insideClass) {
        if (line.match(/^\s*(private|public)?\s*([a-zA-Z0-9_]+)\((.*)\)\s*(:\s*[a-zA-Z0-9_{}[\]\s]+)?\s*\{/)) {
            // Function declaration inside class
            let match = line.match(/^\s*(private|public)?\s*([a-zA-Z0-9_]+)\((.*)\)\s*(:\s*[a-zA-Z0-9_{}[\]\s]+)?\s*\{/);
            let name = match[2];
            let args = match[3];
            let ret = match[4] || ': void';
            
            if (name === 'constructor') {
                newLines.push('function llvm_emitter_new(' + args + ') -> LLVMEmitter {');
                newLines.push('  let global_scope: Scope = scope_new(null);');
                newLines.push('  scope_define(global_scope, "print", "void");');
                newLines.push('  scope_define(global_scope, "readFile", "%str");');
                newLines.push('  scope_define(global_scope, "writeFile", "void");');
                newLines.push('  scope_define(global_scope, "str_length", "i32");');
                newLines.push('  return LLVMEmitter {');
                newLines.push('    out_head: null, out_tail: null,');
                newLines.push('    temp_count: 0, block_count: 0,');
                newLines.push('    struct_layouts: null, function_returns: null,');
                newLines.push('    current_scope: global_scope, target_triple: target_triple');
                newLines.push('  };');
                newLines.push('}');
                // skip constructor body
            } else {
                let vksArgs = args ? 'emitter: LLVMEmitter, ' + args : 'emitter: LLVMEmitter';
                let vksRet = ret.replace(':', '->').replace(/\{ reg: str; type: str \}/, 'EmitResult');
                newLines.push('function ' + name + '(' + vksArgs + ') ' + vksRet + ' {');
            }
            continue;
        }
        
        if (line.trim() === '}' && newLines[newLines.length-1] === '}') {
            // end of class maybe?
            insideClass = false;
        }
    }
    
    // Replace template literals `...`
    line = line.replace(/`([^`]*)`/g, (m, p1) => {
        let s = p1.replace(/\$\{([^}]+)\}/g, '" + toString($1) + "');
        return '"' + s + '"';
    });
    
    // Don't push constructor bodies
    if (!line.includes('this.tempCount = 0;')) {
         newLines.push(line);
    }
}

let result = vks + newLines.join('\n');
fs.writeFileSync('f:\\projects\\VKS\\vks-compiler\\llvm-emitter.vks', result);
console.log('Transpilation complete');
