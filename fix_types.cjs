const fs = require('fs');
let c = fs.readFileSync('vks-compiler/llvm-emitter.vks', 'utf8');

// Replace `function foo(args): type {` with `function foo(args) -> type {`
c = c.replace(/function\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*:\s*([a-zA-Z0-9_{}[\]\s]+)\s*\{/g, 'function $1($2) -> $3 {');

// Fix `switch` statements by converting them to `if / else if`!
// Wait, doing this generally is hard.
// Actually, I can just restore `llvm-emitter.vks` from `HEAD` (before my commit)
// because the original TS to VKS manual port WAS working before the agent overwrote it with `transpile.cjs`!

