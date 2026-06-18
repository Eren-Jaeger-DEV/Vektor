// ============================================================
// Viktor Script — Token Types
// ============================================================
// Every token the lexer can produce. Derived from the Viktor
// Script Language Specification v0.2.
// ============================================================

/**
 * All possible token types in Viktor Script.
 */
export enum TokenType {
  // ── Literals ──────────────────────────────────────────────
  INTEGER_LITERAL = "INTEGER_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  STRING_LITERAL = "STRING_LITERAL",
  CHAR_LITERAL = "CHAR_LITERAL",

  // ── Identifiers ──────────────────────────────────────────
  IDENTIFIER = "IDENTIFIER",

  // ── Keywords ─────────────────────────────────────────────
  LET = "LET",
  CONST = "CONST",
  FUNCTION = "FUNCTION",
  FN = "FN",
  RETURN = "RETURN",
  IF = "IF",
  ELSE = "ELSE",
  WHILE = "WHILE",
  FOR = "FOR",
  IN = "IN",
  STRUCT = "STRUCT",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  IMPORT = "IMPORT",
  BREAK = "BREAK",
  ALLOC = "ALLOC",
  FREE = "FREE",
  CAST = "CAST",
  RESULT = "RESULT",
  OK = "OK",
  ERR = "ERR",
  CLONE = "CLONE",
  MOVE = "MOVE",
  MAP = "MAP",

  // ── Type Keywords ────────────────────────────────────────
  VOID = "VOID",
  BOOL_TYPE = "BOOL_TYPE",
  BYTE = "BYTE",
  STR = "STR",
  I8 = "I8",
  I16 = "I16",
  I32 = "I32",
  I64 = "I64",
  F32 = "F32",
  F64 = "F64",
  PTR = "PTR",

  // ── Operators ────────────────────────────────────────────
  PLUS = "PLUS",                 // +
  MINUS = "MINUS",               // -
  STAR = "STAR",                 // *
  SLASH = "SLASH",               // /
  PERCENT = "PERCENT",           // %
  AMPERSAND = "AMPERSAND",       // &
  BANG = "BANG",                  // !
  EQUALS = "EQUALS",             // =
  DOUBLE_EQUALS = "DOUBLE_EQUALS", // ==
  NOT_EQUALS = "NOT_EQUALS",     // !=
  LESS = "LESS",                 // <
  GREATER = "GREATER",           // >
  LESS_EQUALS = "LESS_EQUALS",   // <=
  GREATER_EQUALS = "GREATER_EQUALS", // >=
  AND_AND = "AND_AND",           // &&
  OR_OR = "OR_OR",               // ||
  PIPE = "PIPE",                 // |
  PLUS_PLUS = "PLUS_PLUS",       // ++
  MINUS_MINUS = "MINUS_MINUS",   // --
  ARROW = "ARROW",               // ->

  // ── Delimiters ───────────────────────────────────────────
  LPAREN = "LPAREN",             // (
  RPAREN = "RPAREN",             // )
  LBRACE = "LBRACE",             // {
  RBRACE = "RBRACE",             // }
  LBRACKET = "LBRACKET",         // [
  RBRACKET = "RBRACKET",         // ]
  SEMICOLON = "SEMICOLON",       // ;
  COLON = "COLON",               // :
  COMMA = "COMMA",               // ,
  DOT = "DOT",                   // .
  DOUBLE_DOT = "DOUBLE_DOT",     // ..
  QUESTION = "QUESTION",         // ?

  // ── Special ──────────────────────────────────────────────
  COMMENT = "COMMENT",           // // ...
  EOF = "EOF",
  UNKNOWN = "UNKNOWN",
}

/**
 * A single token produced by the lexer.
 */
export interface Token {
  /** The type of this token */
  type: TokenType;
  /** The raw source text that was matched */
  lexeme: string;
  /** Parsed value for literals (number, string, boolean, null) */
  literal?: unknown;
  /** 1-based line number where this token starts */
  line: number;
  /** 1-based column number where this token starts */
  column: number;
}

/**
 * Map of reserved keyword strings to their token types.
 * Used by the lexer to distinguish keywords from identifiers.
 */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  // Language keywords
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
  ["true", TokenType.TRUE],
  ["false", TokenType.FALSE],
  ["null", TokenType.NULL],
  ["and", TokenType.AND],
  ["or", TokenType.OR],
  ["not", TokenType.NOT],
  ["import", TokenType.IMPORT],
  ["break", TokenType.BREAK],
  ["alloc", TokenType.ALLOC],
  ["free", TokenType.FREE],
  ["cast", TokenType.CAST],
  ["Result", TokenType.RESULT],
  ["Ok", TokenType.OK],
  ["Err", TokenType.ERR],
  ["clone", TokenType.CLONE],
  ["move", TokenType.MOVE],
  ["map", TokenType.MAP],

  // Type keywords
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
]);
