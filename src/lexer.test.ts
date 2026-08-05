// ============================================================
// Vektor — Lexer Tests
// ============================================================
// Comprehensive test suite covering all token types, edge
// cases, error handling, and full program tokenization.
// ============================================================

import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { TokenType } from "./tokens.js";
import type { Token } from "./tokens.js";

// ── Helper ───────────────────────────────────────────────────

/** Tokenize source and return tokens (excluding EOF unless specified) */
function lex(source: string, includeEOF = false) {
  const lexer = new Lexer(source);
  const { tokens, errors } = lexer.tokenize();
  return {
    tokens: includeEOF ? tokens : tokens.filter((t) => t.type !== TokenType.EOF),
    errors,
  };
}

/** Get just the token types from source */
function types(source: string): TokenType[] {
  return lex(source).tokens.map((t) => t.type);
}

/** Get a single token from source (expects exactly one non-EOF token) */
function single(source: string): Token {
  const result = lex(source);
  expect(result.tokens.length).toBe(1);
  return result.tokens[0];
}

// ── Tests ────────────────────────────────────────────────────

describe("Lexer", () => {
  // ── Integer Literals ─────────────────────────────────────

  describe("integer literals", () => {
    it("should tokenize a simple integer", () => {
      const token = single("42");
      expect(token.type).toBe(TokenType.INTEGER_LITERAL);
      expect(token.lexeme).toBe("42");
      expect(token.literal).toBe(42);
    });

    it("should tokenize zero", () => {
      const token = single("0");
      expect(token.type).toBe(TokenType.INTEGER_LITERAL);
      expect(token.literal).toBe(0);
    });

    it("should tokenize multi-digit integers", () => {
      const token = single("123456789");
      expect(token.type).toBe(TokenType.INTEGER_LITERAL);
      expect(token.literal).toBe(123456789);
    });
  });

  // ── Float Literals ───────────────────────────────────────

  describe("float literals", () => {
    it("should tokenize a simple float", () => {
      const token = single("3.14");
      expect(token.type).toBe(TokenType.FLOAT_LITERAL);
      expect(token.lexeme).toBe("3.14");
      expect(token.literal).toBe(3.14);
    });

    it("should tokenize a float with many decimals", () => {
      const token = single("3.14159265358979");
      expect(token.type).toBe(TokenType.FLOAT_LITERAL);
      expect(token.literal).toBeCloseTo(3.14159265358979);
    });

    it("should tokenize 0.5", () => {
      const token = single("0.5");
      expect(token.type).toBe(TokenType.FLOAT_LITERAL);
      expect(token.literal).toBe(0.5);
    });
  });

  // ── String Literals ──────────────────────────────────────

  describe("string literals", () => {
    it("should tokenize a simple string", () => {
      const token = single('"hello"');
      expect(token.type).toBe(TokenType.STRING_LITERAL);
      expect(token.lexeme).toBe('"hello"');
      expect(token.literal).toBe("hello");
    });

    it("should tokenize an empty string", () => {
      const token = single('""');
      expect(token.type).toBe(TokenType.STRING_LITERAL);
      expect(token.literal).toBe("");
    });

    it("should handle escape sequences", () => {
      const token = single('"hello\\nworld"');
      expect(token.type).toBe(TokenType.STRING_LITERAL);
      expect(token.literal).toBe("hello\nworld");
    });

    it("should handle tab escape", () => {
      const token = single('"a\\tb"');
      expect(token.literal).toBe("a\tb");
    });

    it("should handle escaped quote", () => {
      const token = single('"say \\"hi\\""');
      expect(token.literal).toBe('say "hi"');
    });

    it("should handle escaped backslash", () => {
      const token = single('"path\\\\file"');
      expect(token.literal).toBe("path\\file");
    });

    it("should handle null escape", () => {
      const token = single('"end\\0"');
      expect(token.literal).toBe("end\0");
    });

    it("should report error for unterminated string", () => {
      const { errors } = lex('"unterminated');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Unterminated");
    });

    it("should report error for string with newline", () => {
      const { errors } = lex('"hello\nworld"');
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should report error for invalid escape sequence", () => {
      const { errors } = lex('"bad\\x"');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Invalid escape");
    });
  });

  // ── Char Literals ────────────────────────────────────────

  describe("char literals", () => {
    it("should tokenize a simple char", () => {
      const token = single("'V'");
      expect(token.type).toBe(TokenType.CHAR_LITERAL);
      expect(token.lexeme).toBe("'V'");
      expect(token.literal).toBe("V");
    });

    it("should handle escape sequences in chars", () => {
      const token = single("'\\n'");
      expect(token.type).toBe(TokenType.CHAR_LITERAL);
      expect(token.literal).toBe("\n");
    });

    it("should handle escaped backslash in chars", () => {
      const token = single("'\\\\'");
      expect(token.type).toBe(TokenType.CHAR_LITERAL);
      expect(token.literal).toBe("\\");
    });

    it("should report error for empty char literal", () => {
      const { errors } = lex("''");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Empty character literal");
    });

    it("should report error for unterminated char literal", () => {
      const { errors } = lex("'V");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Boolean Literals ─────────────────────────────────────

  describe("boolean literals", () => {
    it("should tokenize true", () => {
      const token = single("true");
      expect(token.type).toBe(TokenType.TRUE);
      expect(token.literal).toBe(true);
    });

    it("should tokenize false", () => {
      const token = single("false");
      expect(token.type).toBe(TokenType.FALSE);
      expect(token.literal).toBe(false);
    });
  });

  // ── Null ─────────────────────────────────────────────────

  describe("null literal", () => {
    it("should tokenize null", () => {
      const token = single("null");
      expect(token.type).toBe(TokenType.NULL);
      expect(token.literal).toBe(null);
    });
  });

  // ── Keywords ─────────────────────────────────────────────

  describe("keywords", () => {
    const keywordTests: [string, TokenType][] = [
      ["let", TokenType.LET],
      ["const", TokenType.CONST],
      ["function", TokenType.FUNCTION],
      ["fn", TokenType.FN],
      ["return", TokenType.RETURN],
      ["if", TokenType.IF],
      ["else", TokenType.ELSE],
      ["while", TokenType.WHILE],
      ["for", TokenType.FOR],
      ["in", TokenType.IN],
      ["struct", TokenType.STRUCT],
      ["and", TokenType.AND],
      ["or", TokenType.OR],
      ["not", TokenType.NOT],
      ["import", TokenType.IMPORT],
      ["alloc", TokenType.ALLOC],
      ["free", TokenType.FREE],
      ["cast", TokenType.CAST],
      ["Result", TokenType.RESULT],
      ["Ok", TokenType.OK],
      ["Err", TokenType.ERR],
      ["clone", TokenType.CLONE],
      ["move", TokenType.MOVE],
      ["void", TokenType.VOID],
      ["bool", TokenType.BOOL_TYPE],
      ["byte", TokenType.BYTE],
      ["str", TokenType.STR],
      ["i8", TokenType.I8],
      ["i16", TokenType.I16],
      ["i32", TokenType.I32],
      ["i64", TokenType.I64],
      ["f32", TokenType.F32],
      ["f64", TokenType.F64],
      ["ptr", TokenType.PTR],
    ];

    for (const [keyword, expectedType] of keywordTests) {
      it(`should tokenize keyword '${keyword}' as ${expectedType}`, () => {
        const token = single(keyword);
        expect(token.type).toBe(expectedType);
        expect(token.lexeme).toBe(keyword);
      });
    }
  });

  // ── Identifiers ──────────────────────────────────────────

  describe("identifiers", () => {
    it("should tokenize a simple identifier", () => {
      const token = single("myVar");
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.lexeme).toBe("myVar");
    });

    it("should tokenize identifiers with underscores", () => {
      const token = single("my_var_name");
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.lexeme).toBe("my_var_name");
    });

    it("should tokenize identifiers starting with underscore", () => {
      const token = single("_private");
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.lexeme).toBe("_private");
    });

    it("should tokenize identifiers with digits", () => {
      const token = single("player1");
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.lexeme).toBe("player1");
    });

    it("should not confuse keyword prefixes with keywords", () => {
      // "letter" starts with "let" but is not the keyword
      const token = single("letter");
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.lexeme).toBe("letter");
    });

    it("should not confuse 'ifx' with 'if'", () => {
      const token = single("ifx");
      expect(token.type).toBe(TokenType.IDENTIFIER);
    });

    it("should tokenize MAX_PLAYERS as identifier (uppercase)", () => {
      const token = single("MAX_PLAYERS");
      expect(token.type).toBe(TokenType.IDENTIFIER);
    });
  });

  // ── Single-Character Operators ───────────────────────────

  describe("single-character operators", () => {
    const tests: [string, TokenType][] = [
      ["+", TokenType.PLUS],
      ["-", TokenType.MINUS],
      ["*", TokenType.STAR],
      ["/", TokenType.SLASH],
      ["%", TokenType.PERCENT],
      ["&", TokenType.AMPERSAND],
      ["|", TokenType.PIPE],
      ["!", TokenType.BANG],
      ["=", TokenType.EQUALS],
      ["<", TokenType.LESS],
      [">", TokenType.GREATER],
    ];

    for (const [op, expectedType] of tests) {
      it(`should tokenize '${op}' as ${expectedType}`, () => {
        // Wrap in spaces to avoid ambiguity with adjacent tokens
        const { tokens } = lex(op);
        expect(tokens[0].type).toBe(expectedType);
      });
    }
  });

  // ── Double-Character Operators ───────────────────────────

  describe("double-character operators", () => {
    const tests: [string, TokenType][] = [
      ["==", TokenType.DOUBLE_EQUALS],
      ["!=", TokenType.NOT_EQUALS],
      ["<=", TokenType.LESS_EQUALS],
      [">=", TokenType.GREATER_EQUALS],
      ["&&", TokenType.AND_AND],
      ["||", TokenType.OR_OR],
      ["++", TokenType.PLUS_PLUS],
      ["--", TokenType.MINUS_MINUS],
      ["->", TokenType.ARROW],
    ];

    for (const [op, expectedType] of tests) {
      it(`should tokenize '${op}' as ${expectedType}`, () => {
        const token = single(op);
        expect(token.type).toBe(expectedType);
        expect(token.lexeme).toBe(op);
      });
    }
  });

  // ── Delimiters ───────────────────────────────────────────

  describe("delimiters", () => {
    const tests: [string, TokenType][] = [
      ["(", TokenType.LPAREN],
      [")", TokenType.RPAREN],
      ["{", TokenType.LBRACE],
      ["}", TokenType.RBRACE],
      ["[", TokenType.LBRACKET],
      ["]", TokenType.RBRACKET],
      [";", TokenType.SEMICOLON],
      [":", TokenType.COLON],
      [",", TokenType.COMMA],
      [".", TokenType.DOT],
      ["..", TokenType.DOUBLE_DOT],
      ["?", TokenType.QUESTION],
    ];

    for (const [delim, expectedType] of tests) {
      it(`should tokenize '${delim}' as ${expectedType}`, () => {
        const token = single(delim);
        expect(token.type).toBe(expectedType);
        expect(token.lexeme).toBe(delim);
      });
    }
  });

  // ── Comments ─────────────────────────────────────────────

  describe("comments", () => {
    it("should tokenize a comment", () => {
      const token = single("// this is a comment");
      expect(token.type).toBe(TokenType.COMMENT);
      expect(token.lexeme).toBe("// this is a comment");
      expect(token.literal).toBe("this is a comment");
    });

    it("should tokenize an empty comment", () => {
      const token = single("//");
      expect(token.type).toBe(TokenType.COMMENT);
      expect(token.lexeme).toBe("//");
    });

    it("should stop comment at newline", () => {
      const result = lex("// comment\nlet x");
      expect(result.tokens[0].type).toBe(TokenType.COMMENT);
      expect(result.tokens[1].type).toBe(TokenType.LET);
      expect(result.tokens[2].type).toBe(TokenType.IDENTIFIER);
    });

    it("should handle inline comment after code", () => {
      const result = lex('let x: i32 = 10; // inline');
      const commentToken = result.tokens.find((t) => t.type === TokenType.COMMENT);
      expect(commentToken).toBeDefined();
      expect(commentToken!.literal).toBe("inline");
    });
  });

  // ── Whitespace ───────────────────────────────────────────

  describe("whitespace handling", () => {
    it("should skip spaces", () => {
      const result = lex("  42  ");
      expect(result.tokens.length).toBe(1);
      expect(result.tokens[0].type).toBe(TokenType.INTEGER_LITERAL);
    });

    it("should skip tabs", () => {
      const result = lex("\t\t42\t");
      expect(result.tokens.length).toBe(1);
    });

    it("should skip newlines and track line numbers", () => {
      const result = lex("42\n\n100");
      expect(result.tokens.length).toBe(2);
      expect(result.tokens[0].line).toBe(1);
      expect(result.tokens[1].line).toBe(3);
    });

    it("should produce EOF for empty input", () => {
      const result = lex("", true);
      expect(result.tokens.length).toBe(1);
      expect(result.tokens[0].type).toBe(TokenType.EOF);
    });

    it("should produce EOF for whitespace-only input", () => {
      const result = lex("   \n\n\t  ", true);
      expect(result.tokens.length).toBe(1);
      expect(result.tokens[0].type).toBe(TokenType.EOF);
    });
  });

  // ── Line and Column Tracking ─────────────────────────────

  describe("position tracking", () => {
    it("should track column numbers correctly", () => {
      const result = lex("let x = 10;");
      // let  -> col 1
      // x    -> col 5
      // =    -> col 7
      // 10   -> col 9
      // ;    -> col 11
      expect(result.tokens[0].column).toBe(1); // let
      expect(result.tokens[1].column).toBe(5); // x
      expect(result.tokens[2].column).toBe(7); // =
      expect(result.tokens[3].column).toBe(9); // 10
      expect(result.tokens[4].column).toBe(11); // ;
    });

    it("should track line numbers across multiple lines", () => {
      const result = lex("let\nx\n=\n10");
      expect(result.tokens[0].line).toBe(1);
      expect(result.tokens[1].line).toBe(2);
      expect(result.tokens[2].line).toBe(3);
      expect(result.tokens[3].line).toBe(4);
    });

    it("should reset column after newline", () => {
      const result = lex("abc\ndef");
      expect(result.tokens[0].column).toBe(1);
      expect(result.tokens[1].line).toBe(2);
      expect(result.tokens[1].column).toBe(1);
    });
  });

  // ── Ambiguous Cases ──────────────────────────────────────

  describe("ambiguous token disambiguation", () => {
    it("should distinguish -> (arrow) from - (minus)", () => {
      const result = types("a -> b - c");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.ARROW,
        TokenType.IDENTIFIER,
        TokenType.MINUS,
        TokenType.IDENTIFIER,
      ]);
    });

    it("should distinguish .. (range) from . (dot)", () => {
      const result = types("0..10");
      expect(result).toEqual([
        TokenType.INTEGER_LITERAL,
        TokenType.DOUBLE_DOT,
        TokenType.INTEGER_LITERAL,
      ]);
    });

    it("should handle dot access correctly", () => {
      const result = types("p.name");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
      ]);
    });

    it("should distinguish // (comment) from / (slash)", () => {
      const result = types("a / b // comment");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.SLASH,
        TokenType.IDENTIFIER,
        TokenType.COMMENT,
      ]);
    });

    it("should distinguish && from &", () => {
      const result = types("&x && y");
      expect(result).toEqual([
        TokenType.AMPERSAND,
        TokenType.IDENTIFIER,
        TokenType.AND_AND,
        TokenType.IDENTIFIER,
      ]);
    });

    it("should distinguish || from |", () => {
      const result = types("a || b");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.OR_OR,
        TokenType.IDENTIFIER,
      ]);
    });

    it("should distinguish == from =", () => {
      const result = types("x = 5 == 5");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.EQUALS,
        TokenType.INTEGER_LITERAL,
        TokenType.DOUBLE_EQUALS,
        TokenType.INTEGER_LITERAL,
      ]);
    });

    it("should distinguish != from !", () => {
      const result = types("!x != y");
      expect(result).toEqual([
        TokenType.BANG,
        TokenType.IDENTIFIER,
        TokenType.NOT_EQUALS,
        TokenType.IDENTIFIER,
      ]);
    });

    it("should handle float vs range: 3.14 vs 0..10", () => {
      const result = lex("3.14 0..10");
      expect(result.tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(result.tokens[0].literal).toBe(3.14);
      expect(result.tokens[1].type).toBe(TokenType.INTEGER_LITERAL);
      expect(result.tokens[2].type).toBe(TokenType.DOUBLE_DOT);
      expect(result.tokens[3].type).toBe(TokenType.INTEGER_LITERAL);
    });

    it("should handle ++ and -- correctly", () => {
      const result = types("i++ j--");
      expect(result).toEqual([
        TokenType.IDENTIFIER,
        TokenType.PLUS_PLUS,
        TokenType.IDENTIFIER,
        TokenType.MINUS_MINUS,
      ]);
    });
  });

  // ── Error Handling ───────────────────────────────────────

  describe("error handling", () => {
    it("should report unexpected characters", () => {
      const { errors } = lex("@");
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Unexpected character");
    });

    it("should continue lexing after an error", () => {
      const { tokens, errors } = lex("@ let x");
      expect(errors.length).toBe(1);
      // Should still have UNKNOWN + LET + IDENTIFIER tokens
      expect(tokens.some((t) => t.type === TokenType.LET)).toBe(true);
      expect(tokens.some((t) => t.type === TokenType.IDENTIFIER)).toBe(true);
    });

    it("should collect multiple errors", () => {
      const { errors } = lex("@ # $");
      expect(errors.length).toBe(3);
    });
  });

  // ── Full Statement Tokenization ──────────────────────────

  describe("full statements", () => {
    it("should tokenize variable declaration", () => {
      const result = types("let age: i32 = 20;");
      expect(result).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.EQUALS,
        TokenType.INTEGER_LITERAL,
        TokenType.SEMICOLON,
      ]);
    });

    it("should tokenize function declaration", () => {
      const result = types("fn add(a: i32, b: i32) -> i32 {");
      expect(result).toEqual([
        TokenType.FN,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.RPAREN,
        TokenType.ARROW,
        TokenType.I32,
        TokenType.LBRACE,
      ]);
    });

    it("should tokenize struct declaration", () => {
      const result = types("struct Point { x: f32; y: f32; }");
      expect(result).toEqual([
        TokenType.STRUCT,
        TokenType.IDENTIFIER,
        TokenType.LBRACE,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.F32,
        TokenType.SEMICOLON,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.F32,
        TokenType.SEMICOLON,
        TokenType.RBRACE,
      ]);
    });

    it("should tokenize import statement", () => {
      const result = types('import "math.vk";');
      expect(result).toEqual([
        TokenType.IMPORT,
        TokenType.STRING_LITERAL,
        TokenType.SEMICOLON,
      ]);
    });

    it("should tokenize nullable type declaration", () => {
      const result = types("let y: i32? = null;");
      expect(result).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.QUESTION,
        TokenType.EQUALS,
        TokenType.NULL,
        TokenType.SEMICOLON,
      ]);
    });

    it("should tokenize pointer operations", () => {
      const result = types("let p: ptr<i32> = &x;");
      expect(result).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.PTR,
        TokenType.LESS,
        TokenType.I32,
        TokenType.GREATER,
        TokenType.EQUALS,
        TokenType.AMPERSAND,
        TokenType.IDENTIFIER,
        TokenType.SEMICOLON,
      ]);
    });

    it("should tokenize for-in range loop", () => {
      const result = types("for i in 0..10 {");
      expect(result).toEqual([
        TokenType.FOR,
        TokenType.IDENTIFIER,
        TokenType.IN,
        TokenType.INTEGER_LITERAL,
        TokenType.DOUBLE_DOT,
        TokenType.INTEGER_LITERAL,
        TokenType.LBRACE,
      ]);
    });

    it("should tokenize C-style for loop", () => {
      const result = types("for (let i: i32 = 0; i < 10; i++) {");
      expect(result).toEqual([
        TokenType.FOR,
        TokenType.LPAREN,
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.EQUALS,
        TokenType.INTEGER_LITERAL,
        TokenType.SEMICOLON,
        TokenType.IDENTIFIER,
        TokenType.LESS,
        TokenType.INTEGER_LITERAL,
        TokenType.SEMICOLON,
        TokenType.IDENTIFIER,
        TokenType.PLUS_PLUS,
        TokenType.RPAREN,
        TokenType.LBRACE,
      ]);
    });

    it("should tokenize type cast", () => {
      const result = types("let y: f64 = cast<f64>(x);");
      expect(result).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.F64,
        TokenType.EQUALS,
        TokenType.CAST,
        TokenType.LESS,
        TokenType.F64,
        TokenType.GREATER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.SEMICOLON,
      ]);
    });

    it("should tokenize Result type", () => {
      const result = types("fn divide(a: i32, b: i32) -> Result<i32, byte[]> {");
      expect(result).toEqual([
        TokenType.FN,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.I32,
        TokenType.RPAREN,
        TokenType.ARROW,
        TokenType.RESULT,
        TokenType.LESS,
        TokenType.I32,
        TokenType.COMMA,
        TokenType.BYTE,
        TokenType.LBRACKET,
        TokenType.RBRACKET,
        TokenType.GREATER,
        TokenType.LBRACE,
      ]);
    });

    it("should tokenize alloc and free", () => {
      const result = types("let buf: ptr<byte> = alloc(1024); free(buf);");
      expect(result).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.PTR,
        TokenType.LESS,
        TokenType.BYTE,
        TokenType.GREATER,
        TokenType.EQUALS,
        TokenType.ALLOC,
        TokenType.LPAREN,
        TokenType.INTEGER_LITERAL,
        TokenType.RPAREN,
        TokenType.SEMICOLON,
        TokenType.FREE,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.SEMICOLON,
      ]);
    });
  });

  // ── Full Program ─────────────────────────────────────────

  describe("full program", () => {
    it("should tokenize hello world without errors", () => {
      const source = `
function main() {
    print("Hello from Vektor");
}`;
      const { tokens, errors } = lex(source);
      expect(errors).toEqual([]);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].type).toBe(TokenType.FUNCTION);
    });

    it("should tokenize a multi-line program correctly", () => {
      const source = `
let x: i32 = 10;
let y: i32? = null;

if y != null {
    print(y);
}`;
      const { tokens, errors } = lex(source);
      expect(errors).toEqual([]);

      // Verify key tokens exist
      const tokenTypes = tokens.map((t) => t.type);
      expect(tokenTypes).toContain(TokenType.LET);
      expect(tokenTypes).toContain(TokenType.I32);
      expect(tokenTypes).toContain(TokenType.QUESTION);
      expect(tokenTypes).toContain(TokenType.NULL);
      expect(tokenTypes).toContain(TokenType.IF);
      expect(tokenTypes).toContain(TokenType.NOT_EQUALS);
    });

    it("should tokenize struct and function together", () => {
      const source = `
struct Player {
    name: byte[];
    score: i32;
}

fn get_rank(score: i32) -> Result<byte[], byte[]> {
    if score >= 90 {
        return Ok("S Rank");
    } else {
        return Ok("B Rank");
    }
}`;
      const { tokens, errors } = lex(source);
      expect(errors).toEqual([]);

      const tokenTypes = tokens.map((t) => t.type);
      expect(tokenTypes).toContain(TokenType.STRUCT);
      expect(tokenTypes).toContain(TokenType.FN);
      expect(tokenTypes).toContain(TokenType.ARROW);
      expect(tokenTypes).toContain(TokenType.RESULT);
      expect(tokenTypes).toContain(TokenType.OK);
      expect(tokenTypes).toContain(TokenType.RETURN);
      expect(tokenTypes).toContain(TokenType.GREATER_EQUALS);
    });
  });
});
