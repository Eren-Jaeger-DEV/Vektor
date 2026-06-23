const fs = require('fs');
fs.mkdirSync('break_tests', {recursive: true});

let manyLocals = 'function main() {\n';
for(let i = 0; i < 300; i++) manyLocals += `  let a${i}: i32 = ${i};\n`;
manyLocals += '}\n';
fs.writeFileSync('break_tests/break_locals.vks', manyLocals);

let deepNesting = 'function main() {\n  let x: i32 = ';
for(let i = 0; i < 5000; i++) deepNesting += '1 + ';
deepNesting += '1;\n}\n';
fs.writeFileSync('break_tests/break_nesting.vks', deepNesting);

let infRecursion = `
function recurse(n: i32) -> i32 {
  return recurse(n + 1);
}
function main() {
  recurse(1);
}
`;
fs.writeFileSync('break_tests/break_recursion.vks', infRecursion);

let heavyConcat = `
import "string.vks";
import "io.vks";

function main() {
  let s: str = "A";
  for(let i: i32 = 0; i < 5000; i++) {
    s = s + "A";
  }
  print(s);
}
`;
fs.writeFileSync('break_tests/break_concat.vks', heavyConcat);
