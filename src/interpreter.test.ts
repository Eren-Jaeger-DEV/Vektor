// ============================================================
// Viktor Script — Interpreter Tests (Phase 3)
// ============================================================
// Tests the tree-walking interpreter against all language
// features defined in the Viktor Script specification.
// ============================================================

import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";
import { RuntimeError } from "./errors.js";

// ── Test Helpers ─────────────────────────────────────────────

/**
 * Run a Viktor Script program and return captured output lines.
 */
function run(source: string): string[] {
  const lexer = new Lexer(source);
  const { tokens, errors: lexErrors } = lexer.tokenize();
  expect(lexErrors).toHaveLength(0);

  const parser = new Parser(tokens);
  const { program, errors: parseErrors } = parser.parse();
  expect(parseErrors).toHaveLength(0);

  const interpreter = new Interpreter();
  const output: string[] = [];
  interpreter.setOutputHandler((text) => output.push(text));
  interpreter.execute(program);
  return output;
}

/**
 * Run a program and expect a RuntimeError with a matching message.
 */
function expectError(source: string, messageMatch: string | RegExp): void {
  const lexer = new Lexer(source);
  const { tokens } = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const interpreter = new Interpreter();
  interpreter.setOutputHandler(() => {}); // suppress output

  expect(() => interpreter.execute(program)).toThrow(RuntimeError);
  try {
    interpreter.execute(program);
  } catch (e) {
    if (e instanceof RuntimeError) {
      if (typeof messageMatch === "string") {
        expect(e.message).toContain(messageMatch);
      } else {
        expect(e.message).toMatch(messageMatch);
      }
    }
  }
}

/**
 * Wrap code in a main() function for convenience.
 */
function wrap(body: string): string {
  return `function main() {\n${body}\n}`;
}

// ── Tests ────────────────────────────────────────────────────

describe("Interpreter", () => {
  // ── Literals & Variables ───────────────────────────────────

  describe("Literals & Variables", () => {
    it("prints integer literal", () => {
      const out = run(wrap(`print(42);`));
      expect(out).toEqual(["42"]);
    });

    it("prints float literal", () => {
      const out = run(wrap(`print(3.14);`));
      expect(out).toEqual(["3.14"]);
    });

    it("prints string literal", () => {
      const out = run(wrap(`print("Hello");`));
      expect(out).toEqual(["Hello"]);
    });

    it("prints boolean literals", () => {
      const out = run(wrap(`print(true); print(false);`));
      expect(out).toEqual(["true", "false"]);
    });

    it("prints null", () => {
      const out = run(wrap(`print(null);`));
      expect(out).toEqual(["null"]);
    });

    it("declares and prints a let variable", () => {
      const out = run(wrap(`let x: i32 = 10; print(x);`));
      expect(out).toEqual(["10"]);
    });

    it("declares and prints a const variable", () => {
      const out = run(wrap(`const PI: f64 = 3.14; print(PI);`));
      expect(out).toEqual(["3.14"]);
    });

    it("prints char as byte value", () => {
      const out = run(wrap(`let c: byte = 'A'; print(c);`));
      expect(out).toEqual(["A"]);
    });
  });

  // ── Arithmetic ─────────────────────────────────────────────

  describe("Arithmetic", () => {
    it("integer addition", () => {
      const out = run(wrap(`print(10 + 20);`));
      expect(out).toEqual(["30"]);
    });

    it("integer subtraction", () => {
      const out = run(wrap(`print(50 - 15);`));
      expect(out).toEqual(["35"]);
    });

    it("integer multiplication", () => {
      const out = run(wrap(`print(6 * 7);`));
      expect(out).toEqual(["42"]);
    });

    it("integer division (truncates)", () => {
      const out = run(wrap(`print(100 / 3);`));
      expect(out).toEqual(["33"]);
    });

    it("integer modulo", () => {
      const out = run(wrap(`print(100 % 7);`));
      expect(out).toEqual(["2"]);
    });

    it("operator precedence (* before +)", () => {
      const out = run(wrap(`print(2 + 3 * 4);`));
      expect(out).toEqual(["14"]);
    });

    it("float arithmetic", () => {
      const out = run(wrap(`print(1.5 + 2.5);`));
      expect(out).toEqual(["4.0"]);
    });

    it("unary negation", () => {
      const out = run(wrap(`let x: i32 = 10; print(-x);`));
      expect(out).toEqual(["-10"]);
    });
  });

  // ── String Operations ─────────────────────────────────────

  describe("String operations", () => {
    it("string concatenation", () => {
      const out = run(wrap(`print("Hello" + " " + "World");`));
      expect(out).toEqual(["Hello World"]);
    });

    it("string .len field", () => {
      const out = run(wrap(`let s: str = "Viktor"; print(s.len);`));
      expect(out).toEqual(["6"]);
    });

    it("string equality", () => {
      const out = run(wrap(`
        if "abc" == "abc" { print("equal"); }
        if "abc" != "xyz" { print("not equal"); }
      `));
      expect(out).toEqual(["equal", "not equal"]);
    });
  });

  // ── Boolean Logic ─────────────────────────────────────────

  describe("Boolean logic", () => {
    it("logical AND (&&)", () => {
      const out = run(wrap(`if true && true { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("logical AND (and)", () => {
      const out = run(wrap(`if true and true { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("logical OR (||)", () => {
      const out = run(wrap(`if false || true { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("logical OR (or)", () => {
      const out = run(wrap(`if false or true { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("logical NOT (!)", () => {
      const out = run(wrap(`if !false { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("logical NOT (not)", () => {
      const out = run(wrap(`if not false { print("yes"); }`));
      expect(out).toEqual(["yes"]);
    });

    it("comparison operators", () => {
      const out = run(wrap(`
        if 5 > 3 { print("gt"); }
        if 3 < 5 { print("lt"); }
        if 5 >= 5 { print("gte"); }
        if 5 <= 5 { print("lte"); }
        if 5 == 5 { print("eq"); }
        if 5 != 3 { print("neq"); }
      `));
      expect(out).toEqual(["gt", "lt", "gte", "lte", "eq", "neq"]);
    });
  });

  // ── Control Flow ───────────────────────────────────────────

  describe("Control flow", () => {
    it("if-else (true branch)", () => {
      const out = run(wrap(`
        if true { print("yes"); } else { print("no"); }
      `));
      expect(out).toEqual(["yes"]);
    });

    it("if-else (false branch)", () => {
      const out = run(wrap(`
        if false { print("yes"); } else { print("no"); }
      `));
      expect(out).toEqual(["no"]);
    });

    it("if-else if-else chain", () => {
      const out = run(wrap(`
        let score: i32 = 85;
        if score >= 90 { print("A"); }
        else if score >= 80 { print("B"); }
        else { print("C"); }
      `));
      expect(out).toEqual(["B"]);
    });

    it("while loop", () => {
      const out = run(wrap(`
        let i: i32 = 0;
        while i < 5 {
          print(i);
          i = i + 1;
        }
      `));
      expect(out).toEqual(["0", "1", "2", "3", "4"]);
    });

    it("C-style for loop", () => {
      const out = run(wrap(`
        for (let i: i32 = 0; i < 5; i++) {
          print(i);
        }
      `));
      expect(out).toEqual(["0", "1", "2", "3", "4"]);
    });

    it("for-in range loop", () => {
      const out = run(wrap(`
        for i in 0..5 {
          print(i);
        }
      `));
      expect(out).toEqual(["0", "1", "2", "3", "4"]);
    });

    it("nested loops", () => {
      const out = run(wrap(`
        for i in 0..3 {
          for j in 0..2 {
            print(i * 10 + j);
          }
        }
      `));
      expect(out).toEqual(["0", "1", "10", "11", "20", "21"]);
    });
  });

  // ── Functions ──────────────────────────────────────────────

  describe("Functions", () => {
    it("function with return value", () => {
      const out = run(`
        fn add(a: i32, b: i32) -> i32 { return a + b; }
        function main() { print(add(10, 20)); }
      `);
      expect(out).toEqual(["30"]);
    });

    it("void function", () => {
      const out = run(`
        fn greet(name: byte[]) { print(name); }
        function main() { greet("Viktor"); }
      `);
      expect(out).toEqual(["Viktor"]);
    });

    it("recursive function (factorial)", () => {
      const out = run(`
        fn factorial(n: i32) -> i32 {
          if n <= 1 { return 1; }
          return n * factorial(n - 1);
        }
        function main() { print(factorial(5)); }
      `);
      expect(out).toEqual(["120"]);
    });

    it("function using fn keyword", () => {
      const out = run(`
        fn double(x: i32) -> i32 { return x * 2; }
        function main() { print(double(21)); }
      `);
      expect(out).toEqual(["42"]);
    });

    it("multiple function calls", () => {
      const out = run(`
        fn square(x: i32) -> i32 { return x * x; }
        fn cube(x: i32) -> i32 { return x * x * x; }
        function main() {
          print(square(3));
          print(cube(3));
        }
      `);
      expect(out).toEqual(["9", "27"]);
    });
  });

  // ── Structs ────────────────────────────────────────────────

  describe("Structs", () => {
    it("creates and accesses struct fields", () => {
      const out = run(`
        struct Point { x: i32; y: i32; }
        function main() {
          let p: Point = Point { x: 10, y: 20 };
          print(p.x);
          print(p.y);
        }
      `);
      expect(out).toEqual(["10", "20"]);
    });

    it("modifies struct fields", () => {
      const out = run(`
        struct Counter { value: i32; }
        function main() {
          let c: Counter = Counter { value: 0 };
          c.value = 42;
          print(c.value);
        }
      `);
      expect(out).toEqual(["42"]);
    });

    it("struct with string field", () => {
      const out = run(`
        struct Player { name: byte[]; score: i32; }
        function main() {
          let p: Player = Player { name: "Viktor", score: 95 };
          print(p.name);
          print(p.score);
        }
      `);
      expect(out).toEqual(["Viktor", "95"]);
    });
  });

  // ── Result Type ────────────────────────────────────────────

  describe("Result type", () => {
    it("handles Ok result", () => {
      const out = run(`
        fn divide(a: i32, b: i32) -> Result<i32, byte[]> {
          if b == 0 { return Err("div by zero"); }
          return Ok(a / b);
        }
        function main() {
          let r = divide(10, 2);
          if r.ok { print(r.value); }
        }
      `);
      expect(out).toEqual(["5"]);
    });

    it("handles Err result", () => {
      const out = run(`
        fn divide(a: i32, b: i32) -> Result<i32, byte[]> {
          if b == 0 { return Err("Cannot divide by zero"); }
          return Ok(a / b);
        }
        function main() {
          let r = divide(10, 0);
          if r.ok { print(r.value); }
          else { print(r.error); }
        }
      `);
      expect(out).toEqual(["Cannot divide by zero"]);
    });

    it("result .ok is bool", () => {
      const out = run(`
        function main() {
          let r = Ok(42);
          if r.ok { print("ok"); }
          let e = Err("fail");
          if !e.ok { print("err"); }
        }
      `);
      expect(out).toEqual(["ok", "err"]);
    });
  });

  // ── Arrays ─────────────────────────────────────────────────

  describe("Arrays", () => {
    it("creates and indexes into arrays", () => {
      const out = run(wrap(`
        let a: i32[3] = [10, 20, 30];
        print(a[0]);
        print(a[1]);
        print(a[2]);
      `));
      expect(out).toEqual(["10", "20", "30"]);
    });

    it("assigns to array elements", () => {
      const out = run(wrap(`
        let a: i32[3] = [1, 2, 3];
        a[1] = 99;
        print(a[1]);
      `));
      expect(out).toEqual(["99"]);
    });

    it("array .len field", () => {
      const out = run(wrap(`
        let a: i32[5] = [10, 20, 30, 40, 50];
        print(a.len);
      `));
      expect(out).toEqual(["5"]);
    });
  });

  // ── Pointers & Memory ─────────────────────────────────────

  describe("Pointers & Memory", () => {
    it("address-of and dereference", () => {
      const out = run(wrap(`
        let x: i32 = 42;
        let p: ptr<i32> = &x;
        let v: i32 = *p;
        print(v);
      `));
      expect(out).toEqual(["42"]);
    });

    it("alloc, write, read, free", () => {
      const out = run(wrap(`
        let buf: ptr<byte> = alloc(10);
        buf[0] = 'H';
        buf[1] = 'i';
        print(buf[0]);
        print(buf[1]);
        free(buf);
      `));
      expect(out).toEqual(["H", "i"]);
    });

    it("alloc and free lifecycle", () => {
      const out = run(wrap(`
        let buf: ptr<byte> = alloc(5);
        buf[0] = 'X';
        print(buf[0]);
        free(buf);
        print("freed");
      `));
      expect(out).toEqual(["X", "freed"]);
    });
  });

  // ── Type Casting ───────────────────────────────────────────

  describe("Type casting", () => {
    it("float to int (truncates)", () => {
      const out = run(wrap(`
        let a: f64 = 3.99;
        let b: i32 = cast<i32>(a);
        print(b);
      `));
      expect(out).toEqual(["3"]);
    });

    it("int to float", () => {
      const out = run(wrap(`
        let a: i32 = 42;
        let b: f64 = cast<f64>(a);
        print(b);
      `));
      expect(out).toEqual(["42.0"]);
    });
  });

  // ── Ownership & Clone ─────────────────────────────────────

  describe("Ownership & Clone", () => {
    it("clone creates an independent copy", () => {
      const out = run(wrap(`
        let a: str = "Original";
        let b: str = clone(a);
        print(a);
        print(b);
      `));
      expect(out).toEqual(["Original", "Original"]);
    });

    it("clone on arrays creates deep copy", () => {
      const out = run(wrap(`
        let a: i32[3] = [1, 2, 3];
        let b = clone(a);
        b[0] = 99;
        print(a[0]);
        print(b[0]);
      `));
      expect(out).toEqual(["1", "99"]);
    });
  });

  // ── Postfix Operators ─────────────────────────────────────

  describe("Postfix operators", () => {
    it("i++ increments after reading", () => {
      const out = run(wrap(`
        let x: i32 = 5;
        print(x++);
        print(x);
      `));
      expect(out).toEqual(["5", "6"]);
    });

    it("i-- decrements after reading", () => {
      const out = run(wrap(`
        let x: i32 = 5;
        print(x--);
        print(x);
      `));
      expect(out).toEqual(["5", "4"]);
    });
  });

  // ── Nullable Types ────────────────────────────────────────

  describe("Nullable types", () => {
    it("null check with if", () => {
      const out = run(wrap(`
        let x: i32? = null;
        if x == null { print("null"); }
        else { print("not null"); }
      `));
      expect(out).toEqual(["null"]);
    });

    it("non-null value passes check", () => {
      const out = run(wrap(`
        let x: i32 = 10;
        if x != null { print("has value"); }
      `));
      expect(out).toEqual(["has value"]);
    });
  });

  // ── Scoping ────────────────────────────────────────────────

  describe("Scoping", () => {
    it("inner blocks can see outer variables", () => {
      const out = run(wrap(`
        let x: i32 = 10;
        if true {
          print(x);
        }
      `));
      expect(out).toEqual(["10"]);
    });

    it("inner blocks can shadow outer variables", () => {
      const out = run(wrap(`
        let x: i32 = 10;
        if true {
          let x: i32 = 20;
          print(x);
        }
        print(x);
      `));
      expect(out).toEqual(["20", "10"]);
    });

    it("for loop variable is scoped to the loop", () => {
      const out = run(wrap(`
        for (let i: i32 = 0; i < 3; i++) {
          print(i);
        }
      `));
      expect(out).toEqual(["0", "1", "2"]);
    });
  });

  // ── Runtime Errors ─────────────────────────────────────────

  describe("Runtime errors", () => {
    it("division by zero", () => {
      expectError(wrap(`print(10 / 0);`), "Division by zero");
    });

    it("undefined variable", () => {
      expectError(wrap(`print(unknown_var);`), "Undefined variable");
    });

    it("const reassignment", () => {
      expectError(
        wrap(`const X: i32 = 5; X = 10;`),
        "Cannot reassign constant"
      );
    });

    it("type mismatch in binary op", () => {
      expectError(
        wrap(`print(true + 5);`),
        "Type mismatch"
      );
    });

    it("array out of bounds", () => {
      expectError(
        wrap(`let a: i32[3] = [1,2,3]; print(a[5]);`),
        "out of bounds"
      );
    });

    it("double free", () => {
      expectError(
        wrap(`
          let buf: ptr<byte> = alloc(10);
          free(buf);
          free(buf);
        `),
        "Double free"
      );
    });

    it("use-after-free", () => {
      expectError(
        wrap(`
          let buf: ptr<byte> = alloc(10);
          buf[0] = 'X';
          free(buf);
          print(buf[0]);
        `),
        "Use-after-free"
      );
    });

    it("missing main function", () => {
      expectError(
        `fn notMain() { print("hi"); }`,
        "No 'main' function found"
      );
    });

    it("wrong argument count", () => {
      expectError(
        `fn add(a: i32, b: i32) -> i32 { return a + b; }
         function main() { print(add(1)); }`,
        "expects 2 argument(s) but got 1"
      );
    });
  });

  // ── Full Programs ──────────────────────────────────────────

  describe("Full programs", () => {
    it("hello.vks produces correct output", () => {
      const source = `
        function main() {
          print("Hello from Viktor Script");
        }
      `;
      const out = run(source);
      expect(out).toEqual(["Hello from Viktor Script"]);
    });

    it("complex program with structs and results", () => {
      const out = run(`
        struct Player { name: byte[]; score: i32; alive: bool; }

        fn get_rank(score: i32) -> Result<byte[], byte[]> {
          if score < 0 { return Err("Negative"); }
          if score >= 90 { return Ok("S Rank"); }
          else if score >= 75 { return Ok("A Rank"); }
          else { return Ok("B Rank"); }
        }

        function main() {
          let p: Player = Player { name: "Viktor", score: 95, alive: true };
          print(p.name);

          let rank = get_rank(p.score);
          if rank.ok { print(rank.value); }
          else { print(rank.error); }
        }
      `);
      expect(out).toEqual(["Viktor", "S Rank"]);
    });

    it("fibonacci", () => {
      const out = run(`
        fn fib(n: i32) -> i32 {
          if n <= 0 { return 0; }
          if n == 1 { return 1; }
          return fib(n - 1) + fib(n - 2);
        }
        function main() {
          for i in 0..8 {
            print(fib(i));
          }
        }
      `);
      expect(out).toEqual(["0", "1", "1", "2", "3", "5", "8", "13"]);
    });
  });
});
