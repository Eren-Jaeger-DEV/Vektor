// ============================================================
// Vektor — Type Checker Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { TypeChecker } from "./checker.js";

function check(source: string) {
  const lexer = new Lexer(source);
  const { tokens, errors: lexErrors } = lexer.tokenize();
  expect(lexErrors).toHaveLength(0);

  const parser = new Parser(tokens);
  const { program, errors: parseErrors } = parser.parse();
  expect(parseErrors).toHaveLength(0);

  const checker = new TypeChecker();
  return checker.check(program);
}

describe("TypeChecker", () => {
  it("passes on valid variable and function declarations", () => {
    const code = `
      fn add(a: i32, b: i32) -> i32 {
        return a + b;
      }
      function main() {
        let x: i32 = 10;
        let y: i32 = add(x, 20);
        print(y);
      }
    `;
    const { errors } = check(code);
    expect(errors).toHaveLength(0);
  });

  it("catches assignment type mismatches", () => {
    const code = `
      function main() {
        let x: i32 = "hello";
      }
    `;
    const { errors } = check(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Cannot assign 'str' to variable 'x' of type 'i32'");
  });

  it("catches undefined identifier errors", () => {
    const code = `
      function main() {
        let x: i32 = undefinedVar;
      }
    `;
    const { errors } = check(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Undefined identifier 'undefinedVar'");
  });

  it("catches function argument count mismatches", () => {
    const code = `
      fn add(a: i32, b: i32) -> i32 {
        return a + b;
      }
      function main() {
        let res: i32 = add(10);
      }
    `;
    const { errors } = check(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Expected 2 arguments but got 1");
  });

  it("validates struct field access and literals", () => {
    const code = `
      struct Point {
        x: i32;
        y: i32;
      }
      function main() {
        let p: Point = Point { x: 10, y: 20 };
        let px: i32 = p.x;
      }
    `;
    const { errors } = check(code);
    expect(errors).toHaveLength(0);
  });

  it("catches invalid struct field assignments", () => {
    const code = `
      struct Point {
        x: i32;
        y: i32;
      }
      function main() {
        let p: Point = Point { x: "wrong", y: 20 };
      }
    `;
    const { errors } = check(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Field 'x' expected type 'i32', got 'str'");
  });
});
