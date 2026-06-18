import fs from "fs";
import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";
import { Compiler } from "./src/compiler.js";
import { VM, VMPointer } from "./src/vm.js";
import { ConstantType } from "./src/chunk.js";
import { serialize } from "./src/serializer.js";

// Step 1: Run standard TS compiler on compiler.vks and parser.vks (the VKS compiler itself)
// But to do this, we need an entry point script that uses the VKS compiler to compile something!
const source = `
import "vks-compiler/tokens.vks";
import "vks-compiler/ast.vks";
import "vks-compiler/parser.vks";
import "vks-compiler/opcodes.vks";
import "vks-compiler/compiler.vks";

function main() -> Compiler {
  let src: str = "let x = 10; x = x + 5; print(x);";
  
  // 1. Mock lexing (manually create tokens for now)
  let t1: Token = Token { type: "LET", lexeme: "let", line: 1, column: 1, num_val: 0.0, next: null };
  let t2: Token = Token { type: "IDENTIFIER", lexeme: "x", line: 1, column: 5, num_val: 0.0, next: null };
  let t3: Token = Token { type: "EQUALS", lexeme: "=", line: 1, column: 7, num_val: 0.0, next: null };
  let t4: Token = Token { type: "INTEGER_LITERAL", lexeme: "10", line: 1, column: 9, num_val: 10.0, next: null };
  let t5: Token = Token { type: "SEMICOLON", lexeme: ";", line: 1, column: 11, num_val: 0.0, next: null };
  let t6: Token = Token { type: "EOF", lexeme: "", line: 1, column: 12, num_val: 0.0, next: null };
  
  t1.next = t2; t2.next = t3; t3.next = t4; t4.next = t5; t5.next = t6;
  
  // 2. Parse
  let ast: ASTNode = parse(t1);
  
  // 3. Compile
  let c: Compiler = compile(ast);
  return c;
}
`;

const lexer = new Lexer(source);
const { tokens } = lexer.tokenize();
const parser = new Parser(tokens);
const { program: ast } = parser.parse();
const tsCompiler = new Compiler();
const program = tsCompiler.compile(ast!);

const vm = new VM();
try {
  vm.run(program);
} catch (e: any) {
  console.error("VM Run Error:", e.message);
}

const returnedCompiler = vm.lastValue;
console.log("Returned Compiler Pointer:", returnedCompiler);

if (returnedCompiler instanceof VMPointer) {
  const compilerData = vm.heap.get(returnedCompiler.address);
  const chunkPtr = compilerData?.fields.get("chunk");
  
  if (chunkPtr instanceof VMPointer) {
    const chunkData = vm.heap.get(chunkPtr.address);
    console.log("Chunk Name:", chunkData?.fields.get("name"));
    
    // Dump Bytecode
    let codeCurr = chunkData?.fields.get("code_head");
    let codeCount = chunkData?.fields.get("code_count") as number;
    console.log("Bytecode length:", codeCount);
    
    const bytes: number[] = [];
    while (codeCurr instanceof VMPointer) {
      const bData = vm.heap.get(codeCurr.address);
      if (!bData) break;
      bytes.push(bData.fields.get("val") as number);
      codeCurr = bData.fields.get("next");
    }
    
    console.log("Compiled Bytes:", bytes);
  }
}
