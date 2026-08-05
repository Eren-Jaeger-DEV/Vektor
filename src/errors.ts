// ============================================================
// Vektor — Error Types
// ============================================================
// Error types for all compiler phases. Errors are collected
// where possible so the user gets all issues in a single pass.
// ============================================================

import { TokenType, Token } from "./tokens.js";

/**
 * Represents a single error encountered during lexing.
 */
export class LexerError {
  /** 1-based line number where the error occurred */
  readonly line: number;
  /** 1-based column number where the error occurred */
  readonly column: number;
  /** Human-readable error description */
  readonly message: string;

  constructor(line: number, column: number, message: string) {
    this.line = line;
    this.column = column;
    this.message = message;
  }

  /**
   * Format the error for display.
   * Example: "[Line 5, Col 12] Unterminated string literal"
   */
  toString(): string {
    return `[Line ${this.line}, Col ${this.column}] Error: ${this.message}`;
  }
}

/**
 * Represents a single error encountered during parsing.
 */
export class ParseError extends Error {
  /** 1-based line number where the error occurred */
  readonly line: number;
  /** 1-based column number where the error occurred */
  readonly column: number;
  /** The specific token that caused the error */
  readonly token: Token;

  constructor(token: Token, message: string) {
    super(message);
    this.name = "ParseError";
    this.line = token.line;
    this.column = token.column;
    this.token = token;
  }

  /**
   * Format the error for display.
   */
  toString(): string {
    const lexeme = this.token.type === TokenType.EOF ? "EOF" : `'${this.token.lexeme}'`;
    return `[Line ${this.line}, Col ${this.column}] Parse Error at ${lexeme}: ${this.message}`;
  }
}

/**
 * Represents a static type error encountered during type checking.
 */
export class TypeCheckError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(line: number, column: number, message: string) {
    super(message);
    this.name = "TypeCheckError";
    this.line = line;
    this.column = column;
  }

  toString(): string {
    return `[Line ${this.line}, Col ${this.column}] Type Error: ${this.message}`;
  }
}

/**
 * Helper to format a ParseError with a Rust-style source code snippet pointer.
 */
export function formatErrorWithSnippet(err: ParseError, source: string, fileName: string): string {
  const lines = source.split(/\r?\n/);
  const lineIdx = err.line - 1;
  const lineText = lines[lineIdx] || "";
  
  const spanLength = err.token.lexeme.length > 0 ? err.token.lexeme.length : 1;
  
  const lineNumberStr = String(err.line);
  const padding = " ".repeat(lineNumberStr.length);
  const prefix = `${lineNumberStr} | `;
  
  const pointers = "^".repeat(spanLength);
  const pointerPadding = " ".repeat(err.column - 1);
  
  return `error: ${err.message}\n` +
         `  --> ${fileName}:${err.line}:${err.column}\n` +
         ` ${padding} |\n` +
         ` ${prefix}${lineText}\n` +
         ` ${padding} | ${pointerPadding}${pointers}`;
}

/**
 * Represents a runtime error encountered during interpretation.
 */
export class RuntimeError extends Error {
  /** 1-based line number where the error occurred */
  readonly line: number;
  /** 1-based column number where the error occurred */
  readonly column: number;
  /** Formatted call stack from the Virtual Machine */
  public vmTrace?: string[];

  constructor(arg1: number | string, arg2: number, arg3?: string) {
    let message = "";
    let line = 0;
    let column = 0;
    
    if (typeof arg1 === "string") {
      message = arg1;
      line = arg2;
      column = 0;
    } else {
      line = arg1;
      column = arg2;
      message = arg3 || "";
    }
    
    super(message);
    this.name = "RuntimeError";
    this.line = line;
    this.column = column;
  }

  /**
   * Format the error for display.
   */
  toString(): string {
    let base = `[Line ${this.line}, Col ${this.column}] Runtime Error: ${this.message}`;
    if (this.vmTrace && this.vmTrace.length > 0) {
      base += "\nStack trace:\n" + this.vmTrace.join("\n");
    }
    return base;
  }
}

/**
 * Internal signal used to unwind the call stack on `return` statements.
 * This is NOT a real error — it's caught by the function call handler.
 */
export class ReturnSignal extends Error {
  readonly returnValue: unknown; // VKSValue — typed as unknown to avoid circular imports

  constructor(value: unknown) {
    super("return");
    this.name = "ReturnSignal";
    this.returnValue = value;
  }
}
