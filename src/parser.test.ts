// ============================================================
// Vektor — Parser Tests
// ============================================================
// Test suite covering AST node generation, expression precedence,
// statements, declarations, and error recovery.
// ============================================================

import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import * as ast from "./ast.js";

// ── Helpers ──────────────────────────────────────────────────

function parse(source: string) {
  const lexer = new Lexer(source);
  const { tokens } = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function parseExpr(source: string): ast.Expression {
  // Wrap expression in a statement so the parser accepts it at top level,
  // or tweak parser to just parse an expression directly for tests.
  // Actually, our parser parses top-level declarations. Let's just wrap it in a function.
  const code = `fn test() { ${source}; }`;
  const result = parse(code);
  expect(result.errors.length).toBe(0);
  const fnDecl = result.program.declarations[0] as ast.FunctionDecl;
  const stmt = fnDecl.body.statements[0] as ast.ExpressionStatement;
  return stmt.expression;
}

function parseStmt(source: string): ast.Statement {
  const code = `fn test() { ${source} }`;
  const result = parse(code);
  expect(result.errors.length).toBe(0);
  const fnDecl = result.program.declarations[0] as ast.FunctionDecl;
  return fnDecl.body.statements[0];
}

// ── Expressions ──────────────────────────────────────────────

describe("Parser - Expressions", () => {
  it("parses integer literal", () => {
    const expr = parseExpr("42") as ast.IntegerLiteral;
    expect(expr.kind).toBe("IntegerLiteral");
    expect(expr.value).toBe(42);
  });

  it("parses string literal", () => {
    const expr = parseExpr('"hello"') as ast.StringLiteral;
    expect(expr.kind).toBe("StringLiteral");
    expect(expr.value).toBe("hello");
  });

  it("parses binary expressions with correct precedence", () => {
    // 1 + 2 * 3 -> 1 + (2 * 3)
    const expr = parseExpr("1 + 2 * 3") as ast.BinaryExpr;
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.operator.lexeme).toBe("+");
    
    expect(expr.left.kind).toBe("IntegerLiteral");
    
    const right = expr.right as ast.BinaryExpr;
    expect(right.kind).toBe("BinaryExpr");
    expect(right.operator.lexeme).toBe("*");
  });

  it("parses grouping parentheses", () => {
    // (1 + 2) * 3
    const expr = parseExpr("(1 + 2) * 3") as ast.BinaryExpr;
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.operator.lexeme).toBe("*");
    
    const left = expr.left as ast.BinaryExpr;
    expect(left.kind).toBe("BinaryExpr");
    expect(left.operator.lexeme).toBe("+");
  });

  it("parses field access", () => {
    const expr = parseExpr("p.name") as ast.FieldAccessExpr;
    expect(expr.kind).toBe("FieldAccessExpr");
    expect((expr.object as ast.Identifier).name).toBe("p");
    expect(expr.field.name).toBe("name");
  });

  it("parses method calls", () => {
    const expr = parseExpr("print(x)") as ast.CallExpr;
    expect(expr.kind).toBe("CallExpr");
    expect((expr.callee as ast.Identifier).name).toBe("print");
    expect(expr.args.length).toBe(1);
    expect((expr.args[0] as ast.Identifier).name).toBe("x");
  });

  it("parses struct literals", () => {
    const expr = parseExpr("Player { name: \"V\" }") as ast.StructLiteral;
    expect(expr.kind).toBe("StructLiteral");
    expect(expr.name).toBe("Player");
    expect(expr.fields.length).toBe(1);
    expect(expr.fields[0].name.name).toBe("name");
    expect((expr.fields[0].value as ast.StringLiteral).value).toBe("V");
  });

  it("parses array literals", () => {
    const expr = parseExpr("[1, 2, 3]") as ast.ArrayLiteral;
    expect(expr.kind).toBe("ArrayLiteral");
    expect(expr.elements.length).toBe(3);
  });
  
  it("parses cast expressions", () => {
    const expr = parseExpr("cast<i32>(3.14)") as ast.CastExpr;
    expect(expr.kind).toBe("CastExpr");
    expect((expr.targetType as ast.PrimitiveType).name).toBe("i32");
  });
});

// ── Statements ───────────────────────────────────────────────

describe("Parser - Statements", () => {
  it("parses let statement with type and initializer", () => {
    const stmt = parseStmt("let x: i32 = 10;") as ast.LetStatement;
    expect(stmt.kind).toBe("LetStatement");
    expect(stmt.name.name).toBe("x");
    expect((stmt.type as ast.PrimitiveType).name).toBe("i32");
    expect((stmt.initializer as ast.IntegerLiteral).value).toBe(10);
  });

  it("parses let statement without type (inference)", () => {
    const stmt = parseStmt("let x = 10;") as ast.LetStatement;
    expect(stmt.type).toBeUndefined();
    expect((stmt.initializer as ast.IntegerLiteral).value).toBe(10);
  });

  it("parses if statement with else block", () => {
    const stmt = parseStmt("if x > 5 { print(x); } else { print(y); }") as ast.IfStatement;
    expect(stmt.kind).toBe("IfStatement");
    expect(stmt.condition.kind).toBe("BinaryExpr");
    expect(stmt.thenBlock.statements.length).toBe(1);
    expect(stmt.elseBlock).toBeDefined();
    expect(stmt.elseBlock!.kind).toBe("Block");
  });

  it("parses range-style for loop", () => {
    const stmt = parseStmt("for i in 0..10 { }") as ast.ForInStatement;
    expect(stmt.kind).toBe("ForInStatement");
    expect(stmt.variable.name).toBe("i");
    expect((stmt.start as ast.IntegerLiteral).value).toBe(0);
    expect((stmt.end as ast.IntegerLiteral).value).toBe(10);
  });

  it("parses C-style for loop", () => {
    const stmt = parseStmt("for (let i: i32 = 0; i < 10; i++) { }") as ast.ForStatement;
    expect(stmt.kind).toBe("ForStatement");
    expect(stmt.init!.kind).toBe("LetStatement");
    expect(stmt.condition!.kind).toBe("BinaryExpr");
    expect(stmt.update!.kind).toBe("PostfixExpr");
  });
});

// ── Declarations ─────────────────────────────────────────────

describe("Parser - Declarations", () => {
  it("parses import declaration", () => {
    const result = parse('import "io.vk";');
    expect(result.errors.length).toBe(0);
    expect(result.program.imports.length).toBe(1);
    expect(result.program.imports[0].path).toBe("io.vk");
  });

  it("parses struct declaration", () => {
    const code = `
      struct Point {
        x: f32;
        y: f32;
      }
    `;
    const result = parse(code);
    expect(result.errors.length).toBe(0);
    const decl = result.program.declarations[0] as ast.StructDecl;
    expect(decl.kind).toBe("StructDecl");
    expect(decl.name.name).toBe("Point");
    expect(decl.fields.length).toBe(2);
    expect(decl.fields[0].name.name).toBe("x");
    expect((decl.fields[0].type as ast.PrimitiveType).name).toBe("f32");
  });

  it("parses function declaration", () => {
    const code = `
      fn add(a: i32, b: i32) -> i32 {
        return a + b;
      }
    `;
    const result = parse(code);
    expect(result.errors.length).toBe(0);
    const decl = result.program.declarations[0] as ast.FunctionDecl;
    expect(decl.kind).toBe("FunctionDecl");
    expect(decl.name.name).toBe("add");
    expect(decl.params.length).toBe(2);
    expect((decl.returnType as ast.PrimitiveType).name).toBe("i32");
  });
});

// ── Types ────────────────────────────────────────────────────

describe("Parser - Types", () => {
  function parseTypeAnnotation(typeStr: string): ast.TypeNode {
    const stmt = parseStmt(`let x: ${typeStr};`) as ast.LetStatement;
    return stmt.type!;
  }

  it("parses primitive types", () => {
    const t = parseTypeAnnotation("i32") as ast.PrimitiveType;
    expect(t.kind).toBe("PrimitiveType");
    expect(t.name).toBe("i32");
  });

  it("parses pointer types", () => {
    const t = parseTypeAnnotation("ptr<byte>") as ast.PointerType;
    expect(t.kind).toBe("PointerType");
    expect((t.pointeeType as ast.PrimitiveType).name).toBe("byte");
  });

  it("parses fixed-size array types", () => {
    const t = parseTypeAnnotation("i32[5]") as ast.ArrayType;
    expect(t.kind).toBe("ArrayType");
    expect((t.elementType as ast.PrimitiveType).name).toBe("i32");
    expect(t.size).toBe(5);
  });

  it("parses dynamic array types", () => {
    const t = parseTypeAnnotation("byte[]") as ast.ArrayType;
    expect(t.kind).toBe("ArrayType");
    expect((t.elementType as ast.PrimitiveType).name).toBe("byte");
    expect(t.size).toBeUndefined();
  });

  it("parses nullable types", () => {
    const t = parseTypeAnnotation("i32?") as ast.NullableType;
    expect(t.kind).toBe("NullableType");
    expect((t.innerType as ast.PrimitiveType).name).toBe("i32");
  });

  it("parses Result types", () => {
    const t = parseTypeAnnotation("Result<i32, byte[]>") as ast.ResultType;
    expect(t.kind).toBe("ResultType");
    expect((t.okType as ast.PrimitiveType).name).toBe("i32");
    expect(t.errType.kind).toBe("ArrayType");
  });
});

// ── Full Programs ────────────────────────────────────────────

describe("Parser - Full Programs", () => {
  it("parses the hello.vk example without errors", () => {
    const code = `
      function main() {
          print("Hello from Vektor");
      }
    `;
    const result = parse(code);
    expect(result.errors.length).toBe(0);
    expect(result.program.declarations.length).toBe(1);
  });
});

// ── Error Recovery ───────────────────────────────────────────

describe("Parser - Error Recovery", () => {
  it("recovers from missing semicolon", () => {
    const code = `
      fn test() {
        let x = 10  // missing semicolon
        let y = 20;
      }
    `;
    const result = parse(code);
    expect(result.errors.length).toBeGreaterThan(0);
    // Should recover and still parse the rest of the function
    const fnDecl = result.program.declarations[0] as ast.FunctionDecl;
    // The error recovery skips the first let, so only the second let is added to the AST
    expect(fnDecl.body.statements.length).toBe(1); 
    expect(fnDecl.body.statements[0].kind).toBe("ExpressionStatement");
  });
});
