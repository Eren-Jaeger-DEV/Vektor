// ============================================================
// Vektor — Standalone Native Compiler Executable Tests
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";

describe("Standalone Native Vektor Compiler Executable (vektor)", () => {
  const root = process.cwd();
  const vektorBin = resolve(root, process.platform === "win32" ? "vektor.exe" : "vektor");
  const testVk = resolve(root, "_test_native_main.vk");
  const testVkb = resolve(root, "_test_native_main.vkb");

  beforeAll(() => {
    if (!existsSync(vektorBin)) {
      execSync("npx tsx scripts/build-native-compiler.ts", { stdio: "inherit" });
    }
  });

  afterEach(() => {
    if (existsSync(testVk)) unlinkSync(testVk);
    if (existsSync(testVkb)) unlinkSync(testVkb);
  });

  it("1. Native Compiler Binary Exists", () => {
    expect(existsSync(vektorBin)).toBe(true);
  });

  it("2. Compiles and Executes Vektor Programs on VM", () => {
    const source = `
      function main() {
        let x: i32 = 15;
        let y: i32 = 30;
        print(x * y); // 450
      }
    `;

    writeFileSync(testVk, source, "utf-8");

    const output = execSync(`npx tsx src/main.ts compile "${testVk}" -o "${testVkb}" && npx tsx src/main.ts "${testVkb}" --exec`).toString().trim();
    expect(output).toContain("450");
  }, 30000);
});
