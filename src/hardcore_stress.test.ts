// ============================================================
// Vektor — Ultimate Hardcore Stress & Parity Test Suite
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { TypeChecker } from "./checker.js";
import { Interpreter } from "./interpreter.js";
import { VM } from "./vm.js";
import { Serializer } from "./serializer.js";
import { LLVMEmitter } from "./llvm-emitter.js";

function compileSelfHosted(source: string, tempVkPath: string, tempVkbPath: string) {
  writeFileSync(tempVkPath, source);
  const compilerPath = resolve(process.cwd(), "compiler.vkb");
  if (!existsSync(compilerPath)) {
    throw new Error("compiler.vkb not found!");
  }
  const compilerBuffer = readFileSync(compilerPath);
  const serializer = new Serializer();
  const compilerProg = serializer.deserialize(compilerBuffer);

  (global as any).__vks_args = ["compile", tempVkPath, "-o", tempVkbPath];
  const vmCompile = new VM();
  vmCompile.run(compilerProg);

  if (!existsSync(tempVkbPath)) {
    throw new Error("Self-hosted compiler failed to generate .vkb binary");
  }

  const targetBuffer = readFileSync(tempVkbPath);
  return serializer.deserialize(targetBuffer);
}

function runNativeLLVMIfAvailable(source: string, testName: string): string | null {
  try {
    execSync("which clang");
  } catch {
    return null; // Clang not installed on host machine
  }

  const llPath = resolve(process.cwd(), `${testName}.ll`);
  const binPath = resolve(process.cwd(), `${testName}.bin`);

  const lexer = new Lexer(source, `${testName}.vk`);
  const { tokens } = lexer.tokenize();
  const parser = new Parser(tokens, `${testName}.vk`);
  const { program } = parser.parse();
  const checker = new TypeChecker();
  checker.check(program);

  const emitter = new LLVMEmitter();
  const llvmIR = emitter.emit(program);
  writeFileSync(llPath, llvmIR);

  execSync(`clang "${llPath}" runtime.c thread_posix.c -o "${binPath}" -lm -lpthread`);
  const output = execSync(`"${binPath}"`).toString().trim();

  if (existsSync(llPath)) unlinkSync(llPath);
  if (existsSync(binPath)) unlinkSync(binPath);

  return output;
}

describe("ULTIMATE HARDCORE STRESS SUITE: Vektor Compiler & VM & LLVM", () => {
  const tempVk = resolve(process.cwd(), "stress_temp.vk");
  const tempVkb = resolve(process.cwd(), "stress_temp.vkb");

  afterEach(() => {
    if (existsSync(tempVk)) unlinkSync(tempVk);
    if (existsSync(tempVkb)) unlinkSync(tempVkb);
  });

  it("1. HARD STRESS: Complex Recursive Math (Fibonacci, Factorial, GCD, Ackermann)", () => {
    const source = `
      fn fib(n: i32) -> i32 {
        if n <= 1 { return n; }
        return fib(n - 1) + fib(n - 2);
      }

      fn fact(n: i32) -> i32 {
        if n <= 1 { return 1; }
        return n * fact(n - 1);
      }

      fn gcd(a: i32, b: i32) -> i32 {
        if b == 0 { return a; }
        return gcd(b, a % b);
      }

      fn ackermann(m: i32, n: i32) -> i32 {
        if m == 0 { return n + 1; }
        if m > 0 and n == 0 { return ackermann(m - 1, 1); }
        return ackermann(m - 1, ackermann(m, n - 1));
      }

      function main() {
        let f: i32 = fib(10);        // 55
        let fc: i32 = fact(6);       // 720
        let g: i32 = gcd(54, 24);    // 6
        let ack: i32 = ackermann(2, 3); // 9
        print(f + fc + g + ack);     // 55 + 720 + 6 + 9 = 790
      }
    `;

    // A. Interpreter Test
    const lexer = new Lexer(source, "stress1.vk");
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens, "stress1.vk");
    const { program } = parser.parse();
    const checker = new TypeChecker();
    checker.check(program);

    let interpOut: string[] = [];
    const interp = new Interpreter();
    interp.setOutputHandler((msg) => interpOut.push(msg));
    interp.execute(program);
    expect(interpOut.join(" ").trim()).toBe("790");

    // B. Self-Hosted Compiler Test
    const compiledProg = compileSelfHosted(source, tempVk, tempVkb);
    let vmOut: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      vmOut.push(args.join(" "));
    });
    try {
      const vm = new VM();
      vm.run(compiledProg);
    } finally {
      logSpy.mockRestore();
    }
    expect(vmOut.join(" ").trim()).toBe("790");

    // C. LLVM Native Execution Test (if clang available)
    const nativeOut = runNativeLLVMIfAvailable(source, "stress1");
    if (nativeOut !== null) {
      expect(nativeOut).toBe("790");
    }
  });

  it("2. HARD STRESS: Struct Mutation, Arrays & Intrinsics", () => {
    const source = `
      struct Vector3 {
        x: i32;
        y: i32;
        z: i32;
      }

      fn add_vectors(v1: Vector3, v2: Vector3) -> Vector3 {
        return Vector3 {
          x: v1.x + v2.x,
          y: v1.y + v2.y,
          z: v1.z + v2.z
        };
      }

      function main() {
        let a: Vector3 = Vector3 { x: 10, y: 20, z: 30 };
        let b: Vector3 = Vector3 { x: 5, y: 15, z: 25 };
        let sum: Vector3 = add_vectors(a, b);

        let arr: i32[] = array_new();
        array_push(arr, sum.x);
        array_push(arr, sum.y);
        array_push(arr, sum.z);

        let total: i32 = 0;
        let i: i32 = 0;
        while i < array_length(arr) {
          total = total + arr[i];
          i = i + 1;
        }

        print(total); // 15 + 35 + 55 = 105
      }
    `;

    // Self-Hosted Compiler execution
    const compiledProg = compileSelfHosted(source, tempVk, tempVkb);
    let vmOut: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      vmOut.push(args.join(" "));
    });
    try {
      const vm = new VM();
      vm.run(compiledProg);
    } finally {
      logSpy.mockRestore();
    }
    expect(vmOut.join(" ").trim()).toBe("105");

    // Native LLVM compilation & execution
    const nativeOut = runNativeLLVMIfAvailable(source, "stress2");
    if (nativeOut !== null) {
      expect(nativeOut).toBe("105");
    }
  });

  it("3. HARD STRESS: Result<T, E> Pattern & Optionals", () => {
    const source = `
      struct DivisionResult {
        ok: bool;
        value: i32;
        error: str;
      }

      fn safe_divide(numerator: i32, denominator: i32) -> DivisionResult {
        if denominator == 0 {
          return DivisionResult { ok: false, value: 0, error: "Division by zero" };
        }
        return DivisionResult { ok: true, value: numerator / denominator, error: "" };
      }

      function main() {
        let r1: DivisionResult = safe_divide(100, 4);
        let r2: DivisionResult = safe_divide(100, 0);

        let sum: i32 = 0;
        if r1.ok {
          sum = sum + r1.value; // + 25
        }
        if not r2.ok {
          sum = sum + 75;       // + 75
        }

        print(sum); // 100
      }
    `;

    // Self-Hosted Compiler execution
    const compiledProg = compileSelfHosted(source, tempVk, tempVkb);
    let vmOut: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      vmOut.push(args.join(" "));
    });
    try {
      const vm = new VM();
      vm.run(compiledProg);
    } finally {
      logSpy.mockRestore();
    }
    expect(vmOut.join(" ").trim()).toBe("100");

    // Native LLVM execution
    const nativeOut = runNativeLLVMIfAvailable(source, "stress3");
    if (nativeOut !== null) {
      expect(nativeOut).toBe("100");
    }
  });
});
