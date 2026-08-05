import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Interpreter } from "../src/interpreter.js";
import { Declaration } from "../src/ast.js";

const root = process.cwd();
const mainPath = resolve(root, "vektor-compiler", "main.vk");
const resolvedFiles = new Set<string>();
const allDeclarations: Declaration[] = [];

function parseFile(path: string) {
  if (resolvedFiles.has(path)) return;
  resolvedFiles.add(path);

  const source = readFileSync(path, "utf-8");
  const lexer = new Lexer(source, path);
  const { tokens } = lexer.tokenize();
  const parser = new Parser(tokens, path);
  const { program } = parser.parse();

  for (const imp of program.imports) {
    let impPath = typeof imp.path === "string" ? imp.path : (imp.path as any).value;
    if (!impPath) continue;
    if (["lexer.vk", "parser.vk", "ast.vk", "compiler.vk", "opcodes.vk", "tokens.vk", "serializer.vk", "monomorphizer.vk", "llvm-emitter.vk", "pkg.vk"].includes(impPath)) {
      impPath = "vektor-compiler/" + impPath;
    }
    const absPath = resolve(root, impPath);
    if (existsSync(absPath)) {
      parseFile(absPath);
    }
  }

  allDeclarations.push(...program.declarations);
}

console.log("🔄 Re-bootstrapping compiler.vkb via AST Interpreter...");
parseFile(mainPath);

const monoProgram = {
  kind: "Program" as const,
  imports: [],
  declarations: allDeclarations,
  line: 1,
  column: 1
};

(global as any).__vks_args = ["compile", "vektor-compiler/main.vk", "-o", "compiler.vkb"];

const interpreter = new Interpreter();
interpreter.execute(monoProgram);

console.log("🎉 SUCCESS: compiler.vkb re-bootstrapped with latest Vektor compiler fixes!");
