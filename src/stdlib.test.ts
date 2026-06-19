import { describe, it, expect, vi, afterEach } from "vitest";
import assert from "node:assert";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { compileToVM } from "./test_utils.js";
import { VM } from "./vm.js";
import { Interpreter } from "./interpreter.js";
import { STDLIB_ROOT, BUILTIN_NAMES, resolveImportPath, registerInterpreterBuiltins } from "./stdlib.js";
import { Declaration, Program } from "./ast.js";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";

// Capture console.log
let output: string[] = [];
const originalLog = console.log;

function setupMockLog() {
  output = [];
  console.log = (...args: any[]) => {
    output.push(args.join(" "));
  };
}

function teardownMockLog() {
  console.log = originalLog;
}

/** Parse a file and all its imports into a merged program (like main.ts). */
function parseWithImports(entryPath: string): Program {
  const resolvedFiles = new Set<string>();
  const allDeclarations: Declaration[] = [];
  let mainProgram: Program | null = null;

  function parseFile(currentPath: string, isMain: boolean) {
    if (resolvedFiles.has(currentPath)) return;
    resolvedFiles.add(currentPath);

    const source = readFileSync(currentPath, "utf-8");
    const lexer = new Lexer(source);
    const { tokens, errors: lexErrors } = lexer.tokenize();
    if (lexErrors.length > 0) throw lexErrors[0];

    const parser = new Parser(tokens);
    const { program, errors: parseErrors } = parser.parse();
    if (parseErrors.length > 0) throw parseErrors[0];

    if (isMain) mainProgram = program;

    for (const imp of program.imports) {
      parseFile(resolveImportPath(currentPath, imp.path), false);
    }
    allDeclarations.push(...program.declarations);
  }

  parseFile(entryPath, true);
  return {
    kind: "Program",
    imports: mainProgram!.imports,
    declarations: allDeclarations,
    line: mainProgram!.line,
    column: mainProgram!.column,
  };
}

function runVM(source: string) {
  const compiledProgram = compileToVM(source);
  const vm = new VM();
  vm.run(compiledProgram);
  return output;
}

function runVMFile(entrySource: string, entryPath: string) {
  // We can just concatenate the imports with the source instead of the complex parser logic
  // since compileToVM just takes a single string. Wait! compileToVM writes to a temp file,
  // but it does not support multi-file compilation unless we pass it to `vks compile`.
  // Actually, compileToVM writes the string to a temp file, which is perfectly fine 
  // because the `import "stdlib/math.vks"` will be resolved relative to `process.cwd()`.
  const compiledProgram = compileToVM(entrySource);
  const vm = new VM();
  vm.run(compiledProgram);
  return output;
}

function wrap(code: string): string {
  return `function main() { ${code} }`;
}

describe("Standard Library registry", () => {
  it("exports all expected builtin names", () => {
    expect(BUILTIN_NAMES.has("print")).toBe(true);
    expect(BUILTIN_NAMES.has("write_file")).toBe(true);
    expect(BUILTIN_NAMES.has("map_create")).toBe(true);
    expect(BUILTIN_NAMES.size).toBeGreaterThanOrEqual(24);
  });

  it("resolves stdlib imports from project stdlib/", () => {
    const resolved = resolveImportPath(join(STDLIB_ROOT, "math.vks"), "math.vks");
    expect(existsSync(resolved)).toBe(true);
    expect(resolved).toContain("stdlib");
    expect(resolved).toContain("math.vks");
  });
});

describe("Standard Library (VM)", () => {
  afterEach(() => teardownMockLog());

  it("io: toString", () => {
    setupMockLog();
    runVM(wrap(`print(toString(123) + "a");`));
    assert.deepStrictEqual(output, ["123a"]);
  });

  it("io: write_file and read_file", () => {
    const tmp = join(STDLIB_ROOT, "..", "_stdlib_test_tmp.txt");
    setupMockLog();
    runVM(wrap(`
      let ok: bool = write_file("${tmp.replace(/\\/g, "\\\\")}", "hello vks");
      print(ok);
      let content: str = read_file("${tmp.replace(/\\/g, "\\\\")}");
      print(content);
    `));
    teardownMockLog();
    assert.deepStrictEqual(output, ["true", "hello vks"]);
    if (existsSync(tmp)) unlinkSync(tmp);
  });

  it("math: sqrt, pow", () => {
    setupMockLog();
    runVM(wrap(`
      let a: f64 = sqrt(16.0);
      let b: f64 = pow(2.0, 3.0);
      print(a, b);
    `));
    assert.deepStrictEqual(output, ["4 8"]);
  });

  it("math: abs, floor, ceil", () => {
    setupMockLog();
    runVM(wrap(`
      let a: f64 = abs(-5.5);
      let b: f64 = floor(5.9);
      let c: f64 = ceil(5.1);
      print(a, b, c);
    `));
    assert.deepStrictEqual(output, ["5.5 5 6"]);
  });

  it("string: charAt, indexOf", () => {
    setupMockLog();
    runVM(wrap(`
      let s: str = "Viktor";
      print(charAt(s, 0));
      print(indexOf(s, "k"));
      print(indexOf(s, "z"));
    `));
    assert.deepStrictEqual(output, ["V", "2", "-1"]);
  });

  it("string: toUpper, toLower, trim", () => {
    setupMockLog();
    runVM(wrap(`
      let s: str = "  Hello  ";
      print(toUpper(s));
      print(toLower(trim(s)));
    `));
    assert.deepStrictEqual(output, ["  HELLO  ", "hello"]);
  });

  it("string: substring, parseI32", () => {
    setupMockLog();
    runVM(wrap(`
      let s: str = "012345";
      print(substring(s, 1, 4));
      print(parseI32("42") + 8);
    `));
    assert.deepStrictEqual(output, ["123", "50"]);
  });

  it("os: time should be a float", () => {
    setupMockLog();
    runVM(wrap(`
      let t: f64 = time();
      if t > 0.0 {
        print("Time works");
      }
    `));
    assert.deepStrictEqual(output, ["Time works"]);
  });
});

describe("Standard Library (stdlib/*.vks imports)", () => {
  afterEach(() => teardownMockLog());

  it("math.vks: min, max, clamp via import", () => {
    setupMockLog();
    const entry = join(STDLIB_ROOT, "..", "_test_math_main.vks");
    runVMFile(`
      import "stdlib/math.vks";

      function main() {
        print(min(3, 7));
        print(max(3, 7));
        print(clamp(15, 0, 10));
        print(add(5, 10));
      }
    `, entry);
    if (existsSync(entry)) unlinkSync(entry);
    assert.deepStrictEqual(output, ["3", "7", "10", "15"]);
  });

  it("string.vks: len, isEmpty, startsWith via import", () => {
    setupMockLog();
    const entry = join(STDLIB_ROOT, "..", "_test_string_main.vks");
    runVMFile(`
      import "stdlib/string.vks";

      function main() {
        let s: str = "Viktor";
        print(len(s));
        print(isEmpty(""));
        print(startsWith(s, "Vik"));
        print(startsWith(s, "X"));
      }
    `, entry);
    if (existsSync(entry)) unlinkSync(entry);
    assert.deepStrictEqual(output, ["6", "true", "true", "false"]);
  });

  it("memory.vks: alloc_bytes via import", () => {
    setupMockLog();
    const entry = join(STDLIB_ROOT, "..", "_test_memory_main.vks");
    runVMFile(`
      import "stdlib/memory.vks";

      function main() {
        let buf: ptr<byte> = alloc_bytes(4);
        buf[0] = 'A';
        buf[1] = 'B';
        print(buf[0]);
        print(buf[1]);
        free(buf);
      }
    `, entry);
    if (existsSync(entry)) unlinkSync(entry);
    assert.deepStrictEqual(output, ["65", "66"]);
  });
});

describe("Standard Library (Interpreter)", () => {
  it("uses the same builtin registry as VM", () => {
    const interp = new Interpreter();
    interp.setOutputHandler((text) => output.push(text));
    output = [];

    const lexer = new Lexer(wrap(`print(sqrt(9.0));`));
    const { tokens } = lexer.tokenize();
    const { program } = new Parser(tokens).parse();
    interp.execute(program);

    assert.deepStrictEqual(output, ["3.0"]);
  });
});
