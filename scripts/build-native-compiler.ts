// ============================================================
// Vektor — Build Native Compiler Binary (LLVM Ahead-Of-Time)
// ============================================================

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { TypeChecker } from "../src/checker.js";
import { LLVMEmitter } from "../src/llvm-emitter.js";
import { Declaration } from "../src/ast.js";

const root = process.cwd();
const mainPath = resolve(root, "vektor-compiler", "main.vk");
const llPath = resolve(root, "vektor-compiler.ll");
const binName = process.platform === "win32" ? "vektor.exe" : "vektor";
const binPath = resolve(root, binName);

console.log("🔨 Building Standalone Native Vektor Compiler executable...");

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

try {
  parseFile(mainPath);

  const mergedProgram = {
    kind: "Program" as const,
    imports: [],
    declarations: allDeclarations,
    line: 1,
    column: 1
  };

  console.log(`  ✓ Merged ${allDeclarations.length} compiler declarations`);

  const checker = new TypeChecker();
  checker.check(mergedProgram);

  const emitter = new LLVMEmitter();
  try {
    const llvmIR = emitter.emit(mergedProgram);
    writeFileSync(llPath, llvmIR, "utf-8");
    console.log(`  ✓ Generated LLVM IR -> ${llPath}`);
  } catch (err: any) {
    console.error("  ✗ LLVM Emitter error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // Compile with clang or gcc
  let compilerCmd = "";
  try {
    execSync("which clang");
    compilerCmd = `clang "${llPath}" runtime.c thread_posix.c -o "${binPath}" -lm -lpthread`;
  } catch {
    compilerCmd = `gcc -x c "${llPath}" runtime.c thread_posix.c -o "${binPath}" -lm -lpthread`;
  }

  console.log(`  ↓ Compiling machine binary using: ${compilerCmd}`);
  execSync(compilerCmd, { stdio: "inherit" });

  if (existsSync(binPath)) {
    console.log(`  🎉 SUCCESS: Native Vektor Compiler executable created at: ${binPath}`);
  } else {
    throw new Error("Compiler failed to produce binary output");
  }

  if (existsSync(llPath)) unlinkSync(llPath);
} catch (err: any) {
  console.error("  ✗ Build failed:", err.message || err);
  process.exit(1);
}
