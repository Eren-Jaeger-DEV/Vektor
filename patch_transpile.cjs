const fs = require('fs');
let c = fs.readFileSync('vks-compiler/llvm-emitter.vks', 'utf8');
c = c.replace(/let match = exprType\.match.*?;/g, 'let match: str = null;');
c = c.replace(/let escaped = val\.replace.*?;/g, 'let escaped = val;');
// Fix emit_line string
c = c.replace(/emit_line\(emitter, "" \+ toString\(name\) \+ " = private unnamed_addr constant \[" \+ toString\(val\.length \+ 1\) \+ " x i8\] c"" \+ toString\(escaped\) \+ "\\\\00", align 1"\);/g, 'emit_line(emitter, "@" + name + " = private unnamed_addr constant [" + toString(str_length(val) + 1) + " x i8] c\\\"" + val + "\\\\00\\\", align 1");');
c = c.replace(/function emit_line\(emitter: LLVMEmitter, emitter, "define " \+ toString\(retType\) \+ " @" \+ toString\(actualName\) \+ "\(" \+ toString\(params\) \+ "\) -> void \{/g, 'emit_line(emitter, "define " + retType + " @" + actualName + "(" + params + ") {");');
fs.writeFileSync('vks-compiler/llvm-emitter.vks', c);
