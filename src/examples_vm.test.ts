// ============================================================
// Vektor — Example Programs VM-Mode Regression Suite
// ============================================================

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

describe("Example Programs End-to-End VM Execution (--run)", () => {
  const root = process.cwd();

  it("executes examples/hello.vk on Bytecode VM", () => {
    const file = resolve(root, "examples", "hello.vk");
    const output = execSync(`npx tsx src/main.ts "${file}" --run`, { encoding: "utf-8" });
    expect(output).toContain("Hello from Vektor");
    expect(output).toContain("Program finished successfully");
  });

  it("executes examples/full.vk on Bytecode VM", () => {
    const file = resolve(root, "examples", "full.vk");
    const output = execSync(`npx tsx src/main.ts "${file}" --run`, { encoding: "utf-8" });
    expect(output).toContain("Vektor");
    expect(output).toContain("S Rank");
    expect(output).toContain("Program finished successfully");
  });

  it("executes examples/interpreter_demo.vk on Bytecode VM", () => {
    const file = resolve(root, "examples", "interpreter_demo.vk");
    const output = execSync(`npx tsx src/main.ts "${file}" --run`, { encoding: "utf-8" });
    expect(output).toContain("=== Casting ===");
    expect(output).toContain("Program finished successfully");
  });

  it("executes examples/showcase.vk on Bytecode VM", () => {
    const file = resolve(root, "examples", "showcase.vk");
    const output = execSync(`npx tsx src/main.ts "${file}" --run`, { encoding: "utf-8" });
    expect(output).toContain("VEKTOR LANGUAGE SHOWCASE");
    expect(output).toContain("Showcase completed successfully!");
    expect(output).toContain("Program finished successfully");
  });
});
