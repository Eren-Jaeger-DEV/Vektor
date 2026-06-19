// ============================================================
// Viktor Script — Bytecode Compiler Tests
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import { Serializer } from "./serializer.js";
import { Op } from "./opcodes.js";
import { CompiledProgram, ConstantType } from "./chunk.js";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { VM } from "./vm.js";
import { Serializer } from "./serializer.js";

function compileVKS(source: string, tempVksPath: string, tempVkbPath: string) {
  // Write the test source
  writeFileSync(tempVksPath, source);
  
  // Load the self-hosted compiler
  const compilerPath = resolve(process.cwd(), "compiler.vkb");
  if (!existsSync(compilerPath)) {
    throw new Error("compiler.vkb not found! Bootstrap the compiler before running tests.");
  }

  const compilerBuffer = readFileSync(compilerPath);
  const serializer = new Serializer();
  const compilerProg = serializer.deserialize(compilerBuffer);

  // Set the args for the compiler
  (global as any).__vks_args = [tempVksPath, tempVkbPath];

  // Run the compiler in the VM
  const vmCompile = new VM();
  vmCompile.run(compilerProg);

  if (!existsSync(tempVkbPath)) {
    throw new Error("Compiler failed to generate output binary");
  }

  // Load the output binary
  const targetBuffer = readFileSync(tempVkbPath);
  return serializer.deserialize(targetBuffer);
}

describe("Self-Hosted VKS Compiler", () => {
  const tempVks = resolve(process.cwd(), "test_temp.vks");
  const tempVkb = resolve(process.cwd(), "test_temp.vkb");

  afterEach(() => {
    if (existsSync(tempVks)) unlinkSync(tempVks);
    if (existsSync(tempVkb)) unlinkSync(tempVkb);
  });

  it("compiles and executes arithmetic and control flow", () => {
    const source = `
      function main() {
        let x: i32 = 10;
        let y: i32 = 20;
        if (x + y == 30) {
          return 100;
        } else {
          return 0;
        }
      }
    `;

    const compiledProg = compileVKS(source, tempVks, tempVkb);
    const vm = new VM();
    vm.run(compiledProg);

    expect(vm.lastPopped).toBe(100);
  });

  it("compiles and executes structs and arrays", () => {
    const source = `
      struct Point { x: i32; y: i32; }
      function main() {
        let p: Point = Point { x: 5, y: 15 };
        let arr: i32[2] = [p.x, p.y];
        arr[0] = arr[0] + arr[1];
        return arr[0];
      }
    `;

    const compiledProg = compileVKS(source, tempVks, tempVkb);
    const vm = new VM();
    vm.run(compiledProg);

    expect(vm.lastPopped).toBe(20);
  });

  it("compiles array intrinsics natively", () => {
    const source = `
      function main() {
        let arr: i32[] = array_new();
        array_push(arr, 7);
        array_push(arr, 14);
        return array_length(arr);
      }
    `;

    const compiledProg = compileVKS(source, tempVks, tempVkb);
    const vm = new VM();
    vm.run(compiledProg);

    expect(vm.lastPopped).toBe(2);
  });
});
