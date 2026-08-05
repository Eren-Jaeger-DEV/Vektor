// ============================================================
// Vektor — Package Manager Tests
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { initProject, addAndInstall, installAll, resolvePackageEntry } from "./package-manager.js";
import { readManifest } from "./manifest.js";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { TypeChecker } from "./checker.js";
import { Interpreter } from "./interpreter.js";
import { resolveImportPath } from "./stdlib.js";

describe("Vektor Package Manager", () => {
  const testDir = resolve(process.cwd(), "_test_pkg_workspace");

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("1. initProject: creates vektor.json and main.vk starter file", () => {
    mkdirSync(testDir, { recursive: true });
    const manifest = initProject(testDir);

    expect(manifest.name).toBe("_test_pkg_workspace");
    expect(existsSync(join(testDir, "vektor.json"))).toBe(true);
    expect(existsSync(join(testDir, "main.vk"))).toBe(true);
  });

  it("2. addAndInstall & resolvePackageEntry: installs local library and resolves bare import", () => {
    const appDir = join(testDir, "my-app");
    const libDir = join(testDir, "math-lib");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(libDir, { recursive: true });

    // Setup library
    const libManifest = initProject(libDir);
    libManifest.name = "math-lib";
    libManifest.main = "index.vk";

    writeFileSync(join(libDir, "index.vk"), `
      fn square(x: i32) -> i32 {
        return x * x;
      }
    `);

    // Setup app & install local library
    initProject(appDir);
    const pkgName = addAndInstall(appDir, libDir);
    expect(pkgName).toBe("math-lib");

    const appManifest = readManifest(appDir);
    expect(appManifest?.dependencies?.["math-lib"]).toBe(libDir);

    // Resolve bare import
    const resolvedPath = resolveImportPath("main.vk", "math-lib", appDir);
    expect(existsSync(resolvedPath)).toBe(true);
    expect(resolvedPath).toContain("vk_modules");
  });

  it("3. End-to-End: Bare package import execution", () => {
    const appDir = join(testDir, "app");
    const libDir = join(testDir, "utils");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(libDir, { recursive: true });

    // Lib code
    writeFileSync(join(libDir, "index.vk"), `
      fn cube(x: i32) -> i32 {
        return x * x * x;
      }
    `);

    initProject(appDir);
    addAndInstall(appDir, libDir);

    const mainSource = `
      import "utils";

      function main() {
        print(cube(4)); // 64
      }
    `;

    const lexer = new Lexer(mainSource, join(appDir, "main.vk"));
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens, join(appDir, "main.vk"));
    const { program } = parser.parse();

    // Resolve imports manually for test
    const libPath = resolveImportPath(join(appDir, "main.vk"), "utils", appDir);
    const libLexer = new Lexer(require("fs").readFileSync(libPath, "utf-8"), libPath);
    const { tokens: libTokens } = libLexer.tokenize();
    const libParser = new Parser(libTokens, libPath);
    const { program: libProgram } = libParser.parse();

    const mergedProgram = {
      kind: "Program" as const,
      imports: [],
      declarations: [...libProgram.declarations, ...program.declarations],
      line: 1,
      column: 1
    };

    const checker = new TypeChecker();
    checker.check(mergedProgram);

    let output: string[] = [];
    const interp = new Interpreter();
    interp.setOutputHandler((msg) => output.push(msg));
    interp.execute(mergedProgram);

    expect(output.join(" ").trim()).toBe("64");
  });
});
