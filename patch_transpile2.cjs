const fs = require('fs');
let c = fs.readFileSync('vks-compiler/llvm-emitter.vks', 'utf8');
c = c.replace(/`/g, '"');
c = c.replace(/\$\{([^}]+)\}/g, '" + toString($1) + "');
fs.writeFileSync('vks-compiler/llvm-emitter.vks', c);
