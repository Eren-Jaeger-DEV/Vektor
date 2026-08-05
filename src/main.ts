// ============================================================
// Vektor — CLI Entry Point
// ============================================================
// Reads a .vk source file, runs the lexer, parser, and
// optionally the interpreter or VM.
//
// Usage: npx tsx src/main.ts <file> [options]
// ============================================================

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import { Disassembler } from "./disassembler.js";
import { resolveImportPath } from "./stdlib.js";
import { Lexer } from "./lexer.js";
import { Token, TokenType } from "./tokens.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";
import { VM } from "./vm.js";
import { Serializer } from "./serializer.js";
import { Program, Declaration, ASTNode } from "./ast.js";
import { Chunk, ConstantType, CompiledProgram } from "./chunk.js";
import { ASTPrinter } from "./printer.js";
import { TypeChecker } from "./checker.js";
import { RuntimeError, ParseError, LexerError, formatErrorWithSnippet } from "./errors.js";

import { initProject, installAll, addAndInstall } from "./package-manager.js";

const args = process.argv.slice(2);
const cwd = process.cwd();

// --- Package Manager Subcommands ---
if (args[0] === "init") {
  initProject(cwd);
  process.exit(0);
}

if (args[0] === "install") {
  if (args[1]) {
    addAndInstall(cwd, args[1]);
  } else {
    installAll(cwd);
  }
  process.exit(0);
}

// --- Command Delegation to Self-Hosted Multi-Tool ---
if (args[0] === "compile" || args[0] === "build" || args[0] === "--llvm-self") {
  const compilerPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "compiler.vkb");
  if (!existsSync(compilerPath)) {
    console.error("compiler.vkb not found. Please bootstrap the self-hosted compiler first.");
    process.exit(1);
  }
  args.unshift(compilerPath);
  args.push("--exec");
}

if (args.length === 0) {
  console.log("Vektor v0.2.0");
  console.log("Usage: npx tsx src/main.ts <file> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --no-comments    Exclude comment tokens from output");
  console.log("  --json           Output tokens/AST as JSON");
  console.log("  --parse          Run the parser and output the AST");
  console.log("  --compile        Compile to bytecode and output disassembly");
  console.log("  -o <file.vkb>    Output compiled bytecode to a binary file");
  console.log("  --run            Run the program using the Virtual Machine (VM)");
  console.log("  --run-ast        Run the program using the old AST Interpreter");
  console.log("  --exec           Execute a pre-compiled binary file (.vkb)");
  console.log("  --time           Measure and display execution time");
  console.log("  --time           Measure and display execution time");
  console.log("  --target <arch>  Specify LLVM target triple (e.g. x86_64-w64-mingw32)");
  process.exit(0);
}

const filePath = args.find((a) => !a.startsWith("--") && a !== "-o" && args[args.indexOf(a) - 1] !== "-o");
const showComments = !args.includes("--no-comments");
const jsonOutput = args.includes("--json");
const runParser = args.includes("--parse");
const runInterpreter = args.includes("--run");
const runAstInterpreter = args.includes("--run-ast");
const runCompiler = args.includes("--compile") || args.includes("-c") || args.includes("--llvm") || args.includes("--native");
const execBinary = args.includes("--exec");
const showTime = args.includes("--time");

let outputFile: string | null = null;
const oIndex = args.indexOf("-o");
if (oIndex !== -1 && oIndex + 1 < args.length) {
  outputFile = args[oIndex + 1];
}

function detectTargetTriple(): string {
  const platform = os.platform();
  const arch = process.arch;

  if (platform === "win32") return "x86_64-w64-mingw32";
  if (platform === "linux") return "x86_64-unknown-linux-gnu";
  if (platform === "darwin") {
    return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

let targetTriple: string = detectTargetTriple();
const targetIndex = args.indexOf("--target");
if (targetIndex !== -1 && targetIndex + 1 < args.length) {
  targetTriple = args[targetIndex + 1];
}

if (!filePath) {
  console.error("Error: No input file specified.");
  process.exit(1);
}

const resolvedPath = resolve(filePath);
const filePathIndex = args.indexOf(filePath);
(global as any).__vks_args = args.slice(filePathIndex + 1);

// ── Execute Binary File ──────────────────────────────────────

if (execBinary) {
  try {
     const buffer = readFileSync(resolvedPath);
     const serializer = new Serializer();
     const compiledProgram = serializer.deserialize(buffer);

     console.log("");
     console.log(`  ╔══════════════════════════════════════════════════════════════╗`);
     console.log(`  ║  Vektor Virtual Machine                             ║`);
     console.log(`  ║  Binary: ${resolvedPath.length > 50 ? "..." + resolvedPath.slice(-47) : resolvedPath.padEnd(50)} ║`);
     console.log(`  ╚══════════════════════════════════════════════════════════════╝`);
     console.log("");

     const disassembler = new Disassembler();
     const disasmString = disassembler.disassembleProgram(compiledProgram);
     writeFileSync("clean_disassembly.txt", disasmString, "utf-8");
     
     const startTime = performance.now();
     const vm = new VM();
     vm.run(compiledProgram);
     const endTime = performance.now();

     console.log("");
     if (showTime) {
        console.log(`  ✓ Execution finished in ${(endTime - startTime).toFixed(2)}ms.`);
     } else {
        console.log("  ✓ Execution finished.");
     }
     console.log("");
  } catch (e: any) {
     console.error(`\n  ✗ Execution error:`);
     console.error(e);
     console.error(e.stack || e);
     console.error("");
     process.exit(1);
  }
} 
else {
  // ── Import Resolution & Parsing ──────────────────────────────

  const resolvedFiles = new Set<string>();
  const allDeclarations: Declaration[] = [];
  const allLexErrors: { err: LexerError, source: string, path: string }[] = [];
  const allParseErrors: { err: ParseError, source: string, path: string }[] = [];
  let mainTokens: Token[] = [];
  let mainProgram: Program | null = null;

  function parseFile(currentPath: string, isMain: boolean) {
    if (resolvedFiles.has(currentPath)) return;
    console.log("Parsing: " + currentPath);
    resolvedFiles.add(currentPath);

    if (!existsSync(currentPath)) {
       console.error(`Error: Cannot find imported file '${currentPath}'`);
       process.exit(1);
    }

    let source: string;
    try {
      source = readFileSync(currentPath, "utf-8");
    } catch {
      console.error(`Error: Cannot read file '${currentPath}'`);
      process.exit(1);
    }

    const lexer = new Lexer(source);
    const { tokens, errors: lexErrors } = lexer.tokenize();
    allLexErrors.push(...lexErrors.map(e => ({ err: e, source, path: currentPath })));

    if (isMain) {
      mainTokens = tokens;
    }

    const parser = new Parser(tokens);
    const { program, errors: parseErrors } = parser.parse();
    allParseErrors.push(...parseErrors.map(e => ({ err: e, source, path: currentPath })));

    if (isMain) {
      mainProgram = program;
    }

    // Resolve imports recursively
    for (const imp of program.imports) {
      const importPath = resolveImportPath(currentPath, imp.path);
      parseFile(importPath, false);
    }

    // Merge declarations (dependencies first because recursive call finishes before push)
    allDeclarations.push(...program.declarations);
  }

  // Start parsing from the main file
  parseFile(resolvedPath, true);

  // Filter comments for display if needed
  const displayTokens = showComments
    ? mainTokens
    : mainTokens.filter((t) => t.type !== TokenType.COMMENT);

  // ── Output Lexer ─────────────────────────────────────────────

  if (jsonOutput && !runParser && !runCompiler && !runInterpreter && !runAstInterpreter) {
    console.log(JSON.stringify({ tokens: displayTokens, errors: allLexErrors }, null, 2));
  } else if (!runInterpreter && !runAstInterpreter && !runCompiler && !runParser && !outputFile) {
     console.log("");
     console.log(`  ╔══════════════════════════════════════════════════════════════╗`);
     console.log(`  ║  Vektor Lexer                                       ║`);
     console.log(`  ║  File: ${resolvedPath.length > 52 ? "..." + resolvedPath.slice(-49) : resolvedPath.padEnd(52)} ║`);
     console.log(`  ╚══════════════════════════════════════════════════════════════╝`);
     console.log("");

     const header = `  ${"Line".padStart(4)}:${"Col".padEnd(4)} │ ${"Token Type".padEnd(20)} │ Lexeme`;
     const separator = `  ${"─".repeat(9)} │ ${"─".repeat(20)} │ ${"─".repeat(30)}`;
     console.log(header);
     console.log(separator);

     for (const token of displayTokens) {
       const loc = `${String(token.line).padStart(4)}:${String(token.column).padEnd(4)}`;
       const type = token.type.padEnd(20);
       let lexeme = token.lexeme;
       if (lexeme.length > 40) lexeme = lexeme.substring(0, 37) + "...";
       let extra = "";
       if (token.literal !== undefined && token.type !== TokenType.COMMENT && token.type !== TokenType.TRUE && token.type !== TokenType.FALSE && token.type !== TokenType.NULL) {
         const litStr = JSON.stringify(token.literal);
         if (litStr !== JSON.stringify(token.lexeme)) extra = ` → ${litStr}`;
       }
       console.log(`  ${loc} │ ${type} │ ${lexeme}${extra}`);
     }

     console.log(separator);
     console.log(`  Total: ${displayTokens.length} tokens`);
     console.log("");
  }

  if (allLexErrors.length > 0) {
    console.log(`  ⚠ ${allLexErrors.length} lexer error(s):`);
    for (const e of allLexErrors) console.log(`    ${e.err.toString()}`);
    console.log("");
    process.exit(1);
  }

  // Combine into a single massive AST program
  const mergedProgram: Program = {
     kind: "Program",
     imports: mainProgram!.imports,
     declarations: allDeclarations,
     line: mainProgram!.line,
     column: mainProgram!.column,
  };

  // --- Pass 2: Monomorphization (Generics) ---
  // (Monomorphization is now fully handled by the self-hosted compiler)
  const monoProgram = mergedProgram;

  // --- Pass 2.5: Static Type Checker ---
  const typeChecker = new TypeChecker();
  const { errors: typeErrors } = typeChecker.check(monoProgram);
  if (typeErrors.length > 0) {
    const isStrict = args.includes("--strict-types");
    console.log(`  ⚠ ${typeErrors.length} type check warning(s):`);
    for (const e of typeErrors) console.log(`    ${e.toString()}`);
    console.log("");
    if (isStrict) {
      process.exit(1);
    }
  }

  // --- Pass 3: Concurrency Backend Check ---
  if (!runParser && (runInterpreter || runAstInterpreter || runCompiler)) {
    let hasSpawn = false;
    const checkNode = (node: ASTNode) => {
      if (hasSpawn) return;
      if (node.kind === "SpawnExpr") {
        hasSpawn = true;
        return;
      }
      for (const key in node) {
        const val = (node as any)[key];
        if (val && typeof val === "object" && typeof val.kind === "string") {
          checkNode(val);
        } else if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === "object" && typeof item.kind === "string") {
              checkNode(item);
            }
          }
        }
      }
    };
    for (const decl of monoProgram.declarations) checkNode(decl);

    if (hasSpawn) {
      console.error(`\n  ✗ Concurrency Error: 'spawn' requires native compilation. Use --llvm.\n`);
      process.exit(1);
    }
  }

  // ── Run Parser Output ────────────────────────────────────────

  if (runParser || runInterpreter || runAstInterpreter || runCompiler || outputFile) {
    if (runParser) {
      if (jsonOutput) {
        console.log(JSON.stringify({ ast: monoProgram, errors: allParseErrors }, null, 2));
      } else {
        console.log(`  ╔══════════════════════════════════════════════════════════════╗`);
        console.log(`  ║  Vektor Parser (Merged AST)                         ║`);
        console.log(`  ╚══════════════════════════════════════════════════════════════╝`);
        console.log("");

        const printer = new ASTPrinter();
        console.log(printer.print(monoProgram));

        if (allParseErrors.length > 0) {
          console.log(`\n  ⚠ ${allParseErrors.length} parse error(s):\n`);
          for (const e of allParseErrors) {
            console.log(formatErrorWithSnippet(e.err, e.source, e.path));
            console.log("");
          }
          process.exit(1);
        } else {
          console.log("  ✓ AST parsed successfully.");
          console.log("");
        }
      }
    }

    // ── Run Compiler ───────────────────────────────────────────

    if (runCompiler || outputFile) {
      if (allParseErrors.length > 0) {
        console.error(`\n  ⚠ Cannot compile: ${allParseErrors.length} parse error(s) found.\n`);
        for (const e of allParseErrors) {
          console.error(formatErrorWithSnippet(e.err, e.source, e.path));
          console.error("");
        }
        process.exit(1);
      }

      try {
        const compilerPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "compiler.vkb");
        if (!existsSync(compilerPath)) {
          console.error(`\n  ✗ Self-hosted compiler binary (compiler.vkb) not found in the current directory.`);
          console.error(`  Please make sure you have bootstrapped the compiler.\n`);
          process.exit(1);
        }

        const buffer = readFileSync(compilerPath);
        const serializer = new Serializer();
        const compiledProgram = serializer.deserialize(buffer);

        console.log(`  ╔══════════════════════════════════════════════════════════════╗`);
        console.log(`  ║  Vektor Compiler (Self-Hosted)                        ║`);
        console.log(`  ╚══════════════════════════════════════════════════════════════╝`);
        console.log("");

        // Setup CLI arguments for the compiler.vkb
        const vksArgs = ["compile", resolvedPath];
        if (args.includes("--llvm")) vksArgs.push("--llvm");
        if (args.includes("--native")) vksArgs.push("--native");
        if (outputFile) vksArgs.push("-o", outputFile);
        (global as any).__vks_args = vksArgs;

        const vm = new VM();
        vm.run(compiledProgram);

        if (!outputFile) {
           console.log(`  ✓ Compilation finished.`);
        }
      } catch (e: any) {
        console.error(`\n  ✗ Compilation error: ${e.message}`);
        console.error("");
        process.exit(1);
      }
    }

    // ── Run Interpreter or VM ────────────────────────────────────

    if (runInterpreter || runAstInterpreter) {
      if (allParseErrors.length > 0) {
        console.error(`\n  ⚠ Cannot run: ${allParseErrors.length} parse error(s) found.\n`);
        for (const e of allParseErrors) {
          console.error(formatErrorWithSnippet(e.err, e.source, e.path));
          console.error("");
        }
        process.exit(1);
      }

      if (!runParser && !runCompiler) {
        console.log("");
        console.log(`  ╔══════════════════════════════════════════════════════════════╗`);
        if (runAstInterpreter) console.log(`  ║  Vektor AST Interpreter                             ║`);
        else console.log(`  ║  Vektor Virtual Machine                             ║`);
        console.log(`  ║  File: ${resolvedPath.length > 52 ? "..." + resolvedPath.slice(-49) : resolvedPath.padEnd(52)} ║`);
        console.log(`  ╚══════════════════════════════════════════════════════════════╝`);
        console.log("");
      }

      let vmInstance: VM | null = null;
      try {
        const startTime = performance.now();


        if (runAstInterpreter) {
           const interpreter = new Interpreter();
           interpreter.execute(monoProgram);
        } else {
           const compilerPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "compiler.vkb");
           if (!existsSync(compilerPath)) {
             console.error(`\n  ✗ Self-hosted compiler binary (compiler.vkb) not found in the current directory.`);
             console.error(`  Please make sure you have bootstrapped the compiler.\n`);
             process.exit(1);
           }
           
           const compilerBuffer = readFileSync(compilerPath);
           const serializer = new Serializer();
           const compilerProg = serializer.deserialize(compilerBuffer);

           const tempOut = resolvedPath + ".tmp.vkb";
           (global as any).__vks_args = ["compile", resolvedPath, "-o", tempOut];
           
           const vmCompile = new VM();
           vmCompile.run(compilerProg);

           if (!existsSync(tempOut)) {
             console.error(`\n  ✗ Failed to compile ${resolvedPath}`);
             process.exit(1);
           }

           const targetBuffer = readFileSync(tempOut);
           const compiledProgram = serializer.deserialize(targetBuffer);
           
           vmInstance = new VM();
           vmInstance.run(compiledProgram);
        }

        const endTime = performance.now();

        if (!runParser && !runCompiler) {
          console.log("");
          if (showTime) console.log(`  ✓ Program finished successfully in ${(endTime - startTime).toFixed(2)}ms.`);
          console.log("\n  ✓ Program finished successfully.\n");
      
          const last = vmInstance?.lastPopped;
          if (last) {
            // Can optionally print the last value
            // console.log("Last VM value:", last);
          }
          }
      } catch (e) {
        if (e instanceof RuntimeError || (e instanceof Error && e.name === "RuntimeError")) {
          console.error(`\n  ✗ ${e.toString()}`);
          console.error(e.stack);
          console.error("");
          process.exit(1);
        }
        throw e;
      }
    }
  }
}
