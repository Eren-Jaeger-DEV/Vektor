// ============================================================
// Viktor Script — VM Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compileToVM } from "./test_utils.js";
import { VM } from "./vm.js";

// ── Test Helpers ─────────────────────────────────────────────

function compileAndRun(source: string): any[] {
  const fullSource = `function main() { ${source} }`;
  const compiled = compileToVM(fullSource);

  const vm = new VM();
  
  // Capture console.log
  const outputs: any[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    outputs.push(args.join(" "));
  });

  try {
    vm.run(compiled);
  } finally {
    logSpy.mockRestore();
  }

  return outputs;
}

// ── Tests ────────────────────────────────────────────────────

describe("Virtual Machine", () => {
  it("executes basic arithmetic", () => {
    const out = compileAndRun(`
      print(10 + 20);
      print(100 - 30);
      print(5 * 5);
      print(20 / 4);
      print(10 % 3);
      print(-5);
    `);
    expect(out).toEqual(["30", "70", "25", "5", "1", "-5"]);
  });

  it("executes comparisons and logic", () => {
    const out = compileAndRun(`
      print(10 == 10);
      print(10 != 5);
      print(5 < 10);
      print(10 <= 10);
      print(10 > 5);
      print(10 >= 10);
      print(!true);
      print(!false);
    `);
    expect(out).toEqual(["true", "true", "true", "true", "true", "true", "false", "true"]);
  });

  it("executes string concatenation", () => {
    const out = compileAndRun(`
      print("Hello, " + "World");
      print("Value: " + 42);
    `);
    expect(out).toEqual(["Hello, World", "Value: 42"]);
  });

  it("handles local variables", () => {
    const out = compileAndRun(`
      let a: i32 = 10;
      let b: i32 = 20;
      let c: i32 = a + b;
      print(c);
      c = 100;
      print(c);
    `);
    expect(out).toEqual(["30", "100"]);
  });

  it("handles postfix increment/decrement", () => {
    const out = compileAndRun(`
      let a: i32 = 10;
      print(a++);
      print(a);
      print(a--);
      print(a);
    `);
    expect(out).toEqual(["10", "11", "11", "10"]);
  });

  it("handles control flow (if/else)", () => {
    const out = compileAndRun(`
      let a: i32 = 10;
      if a > 5 {
        print("yes");
      } else {
        print("no");
      }
      
      if a < 5 {
        print("yes");
      } else {
        print("no");
      }
    `);
    expect(out).toEqual(["yes", "no"]);
  });

  it("handles loops (while)", () => {
    const out = compileAndRun(`
      let i: i32 = 0;
      while i < 3 {
        print(i);
        i++;
      }
    `);
    expect(out).toEqual(["0", "1", "2"]);
  });

  it("handles loops (for)", () => {
    const out = compileAndRun(`
      for (let i: i32 = 0; i < 3; i++) {
        print(i);
      }
    `);
    expect(out).toEqual(["0", "1", "2"]);
  });

  it("handles loops (for..in)", () => {
    const out = compileAndRun(`
      for i in 1..4 {
        print(i);
      }
    `);
    expect(out).toEqual(["1", "2", "3"]);
  });

  it("executes functions and recursion", () => {
    const source = `
      fn fact(n: i32) -> i32 {
        if n <= 1 { return 1; }
        return n * fact(n - 1);
      }
      function main() {
        print(fact(5));
      }
    `;
    const compiled = compileToVM(source);

    const vm = new VM();
    const outputs: any[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      outputs.push(args.join(" "));
    });

    vm.run(compiled);
    logSpy.mockRestore();

    expect(outputs).toEqual(["120"]);
  });

  it("executes structs", () => {
    const source = `
      struct Point { x: i32; y: i32; }
      function main() {
        let p: Point = Point { x: 10, y: 20 };
        print(p.x);
        p.y = 30;
        print(p.y);
      }
    `;
    const compiled = compileToVM(source);

    const vm = new VM();
    const outputs: any[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => { outputs.push(args.join(" ")); });
    vm.run(compiled);
    logSpy.mockRestore();

    expect(outputs).toEqual(["10", "30"]);
  });

  it("executes arrays", () => {
    const out = compileAndRun(`
      let a: i32[3] = [10, 20, 30];
      print(a[0]);
      a[1] = 99;
      print(a[1]);
      print(a.len);
    `);
    expect(out).toEqual(["10", "99", "3"]);
  });

  it("executes results (Ok/Err)", () => {
    const out = compileAndRun(`
      let o: Result<i32, str> = Ok(42);
      let e: Result<i32, str> = Err("bad");
      print(o.ok);
      print(o.value);
      print(e.ok);
      print(e.error);
    `);
    expect(out).toEqual(["true", "42", "false", "bad"]);
  });

  it("executes memory pointers (alloc/free/deref)", () => {
    const out = compileAndRun(`
      let a: i32 = 10;
      let p: ptr<i32> = &a;
      print(*p);
      
      let heapPtr: ptr<i32> = alloc(4);
      print(heapPtr != null);
      free(heapPtr);
    `);
    expect(out).toEqual(["10", "true"]);
  });
});
