// ============================================================
// Viktor Script — Lexer
// ============================================================
// Single-pass, character-by-character scanner that converts
// raw .vks source text into a stream of typed tokens.
// ============================================================

import { Token, TokenType, KEYWORDS } from "./tokens.js";
import { LexerError } from "./errors.js";

/**
 * Result of running the lexer on source code.
 */
export interface LexResult {
  /** All tokens produced, including EOF */
  tokens: Token[];
  /** All errors encountered during lexing */
  errors: LexerError[];
}

/**
 * Lexer for Viktor Script source code.
 *
 * Usage:
 * ```ts
 * const lexer = new Lexer(sourceCode);
 * const { tokens, errors } = lexer.tokenize();
 * ```
 */
export class Lexer {
  /** The complete source string */
  private readonly source: string;
  /** Current position in the source (index into source string) */
  private pos: number = 0;
  /** Current line number (1-based) */
  private line: number = 1;
  /** Current column number (1-based) */
  private column: number = 1;
  /** Collected tokens */
  private tokens: Token[] = [];
  /** Collected errors */
  private errors: LexerError[] = [];

  constructor(source: string) {
    this.source = source;
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Tokenize the entire source string.
   * Returns all tokens (ending with EOF) and any errors encountered.
   */
  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;
      this.scanToken();
    }

    // Always end with EOF
    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      line: this.line,
      column: this.column,
    });

    return { tokens: this.tokens, errors: this.errors };
  }

  // ── Core Scanner ───────────────────────────────────────────

  /**
   * Scan a single token starting at the current position.
   */
  private scanToken(): void {
    const startLine = this.line;
    const startCol = this.column;
    const ch = this.advance();

    switch (ch) {
      // ── Single-character delimiters ──
      case "(":
        this.addToken(TokenType.LPAREN, ch, startLine, startCol);
        break;
      case ")":
        this.addToken(TokenType.RPAREN, ch, startLine, startCol);
        break;
      case "{":
        this.addToken(TokenType.LBRACE, ch, startLine, startCol);
        break;
      case "}":
        this.addToken(TokenType.RBRACE, ch, startLine, startCol);
        break;
      case "[":
        this.addToken(TokenType.LBRACKET, ch, startLine, startCol);
        break;
      case "]":
        this.addToken(TokenType.RBRACKET, ch, startLine, startCol);
        break;
      case ";":
        this.addToken(TokenType.SEMICOLON, ch, startLine, startCol);
        break;
      case ":":
        this.addToken(TokenType.COLON, ch, startLine, startCol);
        break;
      case ",":
        this.addToken(TokenType.COMMA, ch, startLine, startCol);
        break;
      case "?":
        this.addToken(TokenType.QUESTION, ch, startLine, startCol);
        break;

      // ── Dot / DoubleDot ──
      case ".":
        if (this.peek() === ".") {
          this.advance();
          this.addToken(TokenType.DOUBLE_DOT, "..", startLine, startCol);
        } else {
          this.addToken(TokenType.DOT, ".", startLine, startCol);
        }
        break;

      // ── Operators (single or double char) ──
      case "+":
        if (this.peek() === "+") {
          this.advance();
          this.addToken(TokenType.PLUS_PLUS, "++", startLine, startCol);
        } else {
          this.addToken(TokenType.PLUS, "+", startLine, startCol);
        }
        break;

      case "-":
        if (this.peek() === ">") {
          this.advance();
          this.addToken(TokenType.ARROW, "->", startLine, startCol);
        } else if (this.peek() === "-") {
          this.advance();
          this.addToken(TokenType.MINUS_MINUS, "--", startLine, startCol);
        } else {
          this.addToken(TokenType.MINUS, "-", startLine, startCol);
        }
        break;

      case "*":
        this.addToken(TokenType.STAR, "*", startLine, startCol);
        break;

      case "%":
        this.addToken(TokenType.PERCENT, "%", startLine, startCol);
        break;

      case "/":
        if (this.peek() === "/") {
          // Comment — consume until end of line
          this.advance(); // consume second /
          this.readComment(startLine, startCol);
        } else {
          this.addToken(TokenType.SLASH, "/", startLine, startCol);
        }
        break;

      case "=":
        if (this.peek() === "=") {
          this.advance();
          this.addToken(TokenType.DOUBLE_EQUALS, "==", startLine, startCol);
        } else {
          this.addToken(TokenType.EQUALS, "=", startLine, startCol);
        }
        break;

      case "!":
        if (this.peek() === "=") {
          this.advance();
          this.addToken(TokenType.NOT_EQUALS, "!=", startLine, startCol);
        } else {
          this.addToken(TokenType.BANG, "!", startLine, startCol);
        }
        break;

      case "<":
        if (this.peek() === "=") {
          this.advance();
          this.addToken(TokenType.LESS_EQUALS, "<=", startLine, startCol);
        } else {
          this.addToken(TokenType.LESS, "<", startLine, startCol);
        }
        break;

      case ">":
        if (this.peek() === "=") {
          this.advance();
          this.addToken(TokenType.GREATER_EQUALS, ">=", startLine, startCol);
        } else {
          this.addToken(TokenType.GREATER, ">", startLine, startCol);
        }
        break;

      case "&":
        if (this.peek() === "&") {
          this.advance();
          this.addToken(TokenType.AND_AND, "&&", startLine, startCol);
        } else {
          this.addToken(TokenType.AMPERSAND, "&", startLine, startCol);
        }
        break;

      case "|":
        if (this.peek() === "|") {
          this.advance();
          this.addToken(TokenType.OR_OR, "||", startLine, startCol);
        } else {
          this.addToken(TokenType.PIPE, "|", startLine, startCol);
        }
        break;

      // ── String literal ──
      case '"':
        this.readString(startLine, startCol);
        break;

      // ── Char literal ──
      case "'":
        this.readChar(startLine, startCol);
        break;

      default:
        // ── Number literal ──
        if (this.isDigit(ch)) {
          this.readNumber(ch, startLine, startCol);
        }
        // ── Identifier or keyword ──
        else if (this.isAlpha(ch)) {
          this.readIdentifierOrKeyword(ch, startLine, startCol);
        }
        // ── Unknown character ──
        else {
          this.errors.push(
            new LexerError(startLine, startCol, `Unexpected character: '${ch}'`)
          );
          this.addToken(TokenType.UNKNOWN, ch, startLine, startCol);
        }
        break;
    }
  }

  // ── Literal Readers ────────────────────────────────────────

  /**
   * Read a number literal (integer or float).
   * Handles: 123, 3.14, 0
   */
  private readNumber(
    firstChar: string,
    startLine: number,
    startCol: number
  ): void {
    let value = firstChar;
    let isFloat = false;

    // Consume digits
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Check for decimal point (but not range operator "..")
    if (
      !this.isAtEnd() &&
      this.peek() === "." &&
      this.peekNext() !== "."
    ) {
      // It's a float if the char after "." is a digit
      if (this.peekNext() !== undefined && this.isDigit(this.peekNext()!)) {
        isFloat = true;
        value += this.advance(); // consume the "."
        while (!this.isAtEnd() && this.isDigit(this.peek())) {
          value += this.advance();
        }
      }
    }

    if (isFloat) {
      this.addToken(TokenType.FLOAT_LITERAL, value, startLine, startCol, parseFloat(value));
    } else {
      this.addToken(TokenType.INTEGER_LITERAL, value, startLine, startCol, parseInt(value, 10));
    }
  }

  /**
   * Read a string literal enclosed in double quotes.
   * Handles escape sequences: \", \\, \n, \t, \r, \0
   */
  private readString(startLine: number, startCol: number): void {
    let value = "";
    let lexeme = '"';

    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.peek();

      // Strings cannot span multiple lines
      if (ch === "\n") {
        this.errors.push(
          new LexerError(startLine, startCol, "Unterminated string literal (newline before closing quote)")
        );
        // Don't consume the newline — let the main loop handle it
        this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
        return;
      }

      if (ch === "\\") {
        // Escape sequence
        this.advance(); // consume backslash
        lexeme += "\\";

        if (this.isAtEnd()) {
          this.errors.push(
            new LexerError(this.line, this.column, "Unterminated escape sequence at end of file")
          );
          this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
          return;
        }

        const escaped = this.advance();
        lexeme += escaped;

        switch (escaped) {
          case '"':  value += '"'; break;
          case '\\': value += '\\'; break;
          case 'n':  value += '\n'; break;
          case 't':  value += '\t'; break;
          case 'r':  value += '\r'; break;
          case '0':  value += '\0'; break;
          default:
            this.errors.push(
              new LexerError(this.line, this.column - 1, `Invalid escape sequence: '\\${escaped}'`)
            );
            value += escaped;
            break;
        }
      } else {
        const consumed = this.advance();
        value += consumed;
        lexeme += consumed;
      }
    }

    if (this.isAtEnd()) {
      this.errors.push(
        new LexerError(startLine, startCol, "Unterminated string literal (reached end of file)")
      );
      this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
      return;
    }

    // Consume the closing quote
    this.advance();
    lexeme += '"';

    this.addToken(TokenType.STRING_LITERAL, lexeme, startLine, startCol, value);
  }

  /**
   * Read a character literal enclosed in single quotes.
   * Handles escape sequences like strings.
   * Example: 'V', '\n', '\\'
   */
  private readChar(startLine: number, startCol: number): void {
    let value: string;
    let lexeme = "'";

    if (this.isAtEnd()) {
      this.errors.push(
        new LexerError(startLine, startCol, "Unterminated character literal")
      );
      this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
      return;
    }

    if (this.peek() === "\\") {
      // Escape sequence in char
      this.advance(); // consume backslash
      lexeme += "\\";

      if (this.isAtEnd()) {
        this.errors.push(
          new LexerError(startLine, startCol, "Unterminated escape sequence in character literal")
        );
        this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
        return;
      }

      const escaped = this.advance();
      lexeme += escaped;

      switch (escaped) {
        case "'":  value = "'"; break;
        case "\\": value = "\\"; break;
        case "n":  value = "\n"; break;
        case "t":  value = "\t"; break;
        case "r":  value = "\r"; break;
        case "0":  value = "\0"; break;
        default:
          this.errors.push(
            new LexerError(startLine, startCol, `Invalid escape sequence in character literal: '\\${escaped}'`)
          );
          value = escaped;
          break;
      }
    } else if (this.peek() === "'") {
      // Empty char literal ''
      this.errors.push(
        new LexerError(startLine, startCol, "Empty character literal")
      );
      this.advance(); // consume closing quote
      lexeme += "'";
      this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
      return;
    } else {
      const ch = this.advance();
      value = ch;
      lexeme += ch;
    }

    // Expect closing single quote
    if (this.isAtEnd() || this.peek() !== "'") {
      this.errors.push(
        new LexerError(startLine, startCol, "Unterminated character literal (expected closing single quote)")
      );
      this.addToken(TokenType.UNKNOWN, lexeme, startLine, startCol);
      return;
    }

    this.advance(); // consume closing quote
    lexeme += "'";

    this.addToken(TokenType.CHAR_LITERAL, lexeme, startLine, startCol, value);
  }

  /**
   * Read a comment from after the `//` to the end of the line.
   */
  private readComment(startLine: number, startCol: number): void {
    let content = "";

    while (!this.isAtEnd() && this.peek() !== "\n") {
      content += this.advance();
    }

    // Store the full comment including the //
    this.addToken(TokenType.COMMENT, "//" + content, startLine, startCol, content.trim());
  }

  /**
   * Read an identifier or keyword.
   * Identifiers: [a-zA-Z_][a-zA-Z0-9_]*
   * If the identifier matches a reserved keyword, emit the keyword token instead.
   */
  private readIdentifierOrKeyword(
    firstChar: string,
    startLine: number,
    startCol: number
  ): void {
    let value = firstChar;

    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    // Check if it's a reserved keyword
    const keywordType = KEYWORDS.get(value);
    if (keywordType !== undefined) {
      // Special handling for boolean literals
      if (keywordType === TokenType.TRUE) {
        this.addToken(keywordType, value, startLine, startCol, true);
      } else if (keywordType === TokenType.FALSE) {
        this.addToken(keywordType, value, startLine, startCol, false);
      } else if (keywordType === TokenType.NULL) {
        this.addToken(keywordType, value, startLine, startCol, null);
      } else {
        this.addToken(keywordType, value, startLine, startCol);
      }
    } else {
      this.addToken(TokenType.IDENTIFIER, value, startLine, startCol);
    }
  }

  // ── Character Utilities ────────────────────────────────────

  /** Check if we've consumed all source characters */
  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  /** Return the current character and advance the position */
  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;

    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return ch;
  }

  /** Look at the current character without consuming it */
  private peek(): string {
    return this.source[this.pos];
  }

  /** Look at the next character (one ahead of current) without consuming */
  private peekNext(): string | undefined {
    if (this.pos + 1 >= this.source.length) return undefined;
    return this.source[this.pos + 1];
  }

  /** Skip whitespace characters (spaces, tabs, carriage returns, newlines) */
  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else {
        break;
      }
    }
  }

  /** Check if a character is a digit [0-9] */
  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  /** Check if a character is alphabetic or underscore [a-zA-Z_] */
  private isAlpha(ch: string): boolean {
    return (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      ch === "_"
    );
  }

  /** Check if a character is alphanumeric or underscore [a-zA-Z0-9_] */
  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  // ── Token Construction ─────────────────────────────────────

  /** Create and store a token */
  private addToken(
    type: TokenType,
    lexeme: string,
    line: number,
    column: number,
    literal?: unknown
  ): void {
    const token: Token = { type, lexeme, line, column };
    if (literal !== undefined) {
      token.literal = literal;
    }
    this.tokens.push(token);
  }
}
