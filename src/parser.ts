// ============================================================
// Viktor Script — Parser
// ============================================================
// Recursive descent parser with Pratt-style expression parsing.
// Converts a flat token stream into an Abstract Syntax Tree (AST).
// ============================================================

import { Token, TokenType } from "./tokens.js";
import { ParseError } from "./errors.js";
import * as ast from "./ast.js";

// ── Precedence Levels ────────────────────────────────────────

enum Precedence {
  NONE = 0,
  ASSIGNMENT = 1, // =
  OR = 2,         // ||, or
  AND = 3,        // &&, and
  EQUALITY = 4,   // ==, !=
  COMPARISON = 5, // <, >, <=, >=
  TERM = 6,       // +, -
  FACTOR = 7,     // *, /, %
  UNARY = 8,      // !, -, *, &
  CALL = 9,       // .field, [index], (args)
  POSTFIX = 10,   // ++, --
}

// ── Parser ───────────────────────────────────────────────────

export interface ParseResult {
  program: ast.Program;
  errors: ParseError[];
}

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    // Filter out comments before parsing
    this.tokens = tokens.filter((t) => t.type !== TokenType.COMMENT);
  }

  public parse(): ParseResult {
    const imports: ast.ImportDecl[] = [];
    const declarations: ast.Declaration[] = [];

    const firstToken = this.peek();

    try {
      while (!this.isAtEnd()) {
        if (this.match(TokenType.IMPORT)) {
          imports.push(this.parseImportDecl());
        } else {
          declarations.push(this.parseDeclaration());
        }
      }
    } catch (e) {
      if (e instanceof ParseError) {
        // Main loop error should have been caught and synchronized, but just in case
      } else {
        throw e;
      }
    }

    const program: ast.Program = {
      kind: "Program",
      imports,
      declarations,
      line: firstToken.line,
      column: firstToken.column,
    };

    return { program, errors: this.errors };
  }

  // ── Declarations ───────────────────────────────────────────

  private parseImportDecl(): ast.ImportDecl {
    const importToken = this.previous();
    const pathToken = this.consume(TokenType.STRING_LITERAL, "Expected string path after 'import'.");
    this.consume(TokenType.SEMICOLON, "Expected ';' after import declaration.");

    return {
      kind: "ImportDecl",
      path: pathToken.literal as string,
      line: importToken.line,
      column: importToken.column,
    };
  }

  private parseDeclaration(): ast.Declaration {
    try {
      if (this.match(TokenType.STRUCT)) {
        return this.parseStructDecl();
      }
      if (this.match(TokenType.FUNCTION) || this.match(TokenType.FN)) {
        return this.parseFunctionDecl();
      }
      if (this.match(TokenType.CONST)) {
        return this.parseConstStatement();
      }
      // Top-level must be struct, fn, or const (or import handled above)
      throw this.error(this.peek(), "Expected 'struct', 'function', 'fn', or 'const' declaration.");
    } catch (e) {
      if (e instanceof ParseError) {
        this.synchronize();
        // Return a dummy declaration to keep types happy; it will be ignored mostly because errors array is non-empty
        return {
          kind: "StructDecl",
          name: { kind: "Identifier", name: "$error", line: 0, column: 0 },
          fields: [],
          line: 0,
          column: 0,
        };
      }
      throw e;
    }
  }

  private parseGenericParams(): ast.Identifier[] | undefined {
    if (!this.match(TokenType.LESS)) return undefined;
    const params: ast.Identifier[] = [];
    do {
      params.push(this.parseIdentifier("Expected generic parameter name."));
    } while (this.match(TokenType.COMMA));
    this.consume(TokenType.GREATER, "Expected '>' after generic parameters.");
    return params;
  }

  private parseStructDecl(): ast.StructDecl {
    const structToken = this.previous();
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected struct name.");
    const typeParams = this.parseGenericParams();
    
    this.consume(TokenType.LBRACE, "Expected '{' before struct body.");
    
    const fields: ast.StructField[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const fieldName = this.parseIdentifier();
      this.consume(TokenType.COLON, "Expected ':' after field name.");
      const fieldType = this.parseType();
      this.consume(TokenType.SEMICOLON, "Expected ';' after struct field.");
      
      fields.push({
        name: fieldName,
        type: fieldType,
        line: fieldName.line,
        column: fieldName.column,
      });
    }
    
    this.consume(TokenType.RBRACE, "Expected '}' after struct body.");

    return {
      kind: "StructDecl",
      name: this.createIdentifier(nameToken),
      typeParams,
      fields,
      line: structToken.line,
      column: structToken.column,
    };
  }

  private parseFunctionDecl(): ast.FunctionDecl {
    const fnToken = this.previous();
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected function name.");
    const typeParams = this.parseGenericParams();

    this.consume(TokenType.LPAREN, "Expected '(' after function name.");
    const params: ast.FunctionParam[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramName = this.parseIdentifier("Expected parameter name.");
        this.consume(TokenType.COLON, "Expected ':' after parameter name.");
        const paramType = this.parseType();
        params.push({
          name: paramName,
          type: paramType,
          line: paramName.line,
          column: paramName.column,
        });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expected ')' after parameters.");

    let returnType: ast.TypeNode | undefined;
    if (this.match(TokenType.ARROW)) {
      if (this.match(TokenType.VOID)) {
        returnType = undefined;
      } else {
        returnType = this.parseType();
      }
    }

    this.consume(TokenType.LBRACE, "Expected '{' before function body.");
    const body = this.parseBlockBody(this.previous());

    return {
      kind: "FunctionDecl",
      name: this.createIdentifier(nameToken),
      typeParams,
      params,
      returnType,
      body,
      line: fnToken.line,
      column: fnToken.column,
    };
  }

  // ── Statements ─────────────────────────────────────────────

  private parseStatement(): ast.Statement {
    try {
      if (this.match(TokenType.LET)) return this.parseLetStatement();
      if (this.match(TokenType.CONST)) return this.parseConstStatement();
      if (this.match(TokenType.RETURN)) return this.parseReturnStatement();
      if (this.match(TokenType.IF)) return this.parseIfStatement();
      if (this.match(TokenType.WHILE)) return this.parseWhileStatement();
      if (this.match(TokenType.FOR)) return this.parseForStatement();
      if (this.match(TokenType.BREAK)) return this.parseBreakStatement();
      if (this.match(TokenType.LBRACE)) return this.parseBlockBody(this.previous());

      return this.parseExpressionStatement();
    } catch (e) {
      if (e instanceof ParseError) {
        this.synchronize();
        return {
          kind: "ExpressionStatement",
          expression: { kind: "NullLiteral", line: 0, column: 0 },
          line: 0,
          column: 0,
        };
      }
      throw e;
    }
  }

  private parseLetStatement(): ast.LetStatement {
    const letToken = this.previous();
    const name = this.parseIdentifier("Expected variable name.");

    let type: ast.TypeNode | undefined;
    if (this.match(TokenType.COLON)) {
      type = this.parseType();
    }

    let initializer: ast.Expression | undefined;
    if (this.match(TokenType.EQUALS)) {
      initializer = this.parseExpression();
    }

    this.consume(TokenType.SEMICOLON, "Expected ';' after variable declaration.");

    if (!type && !initializer) {
      this.error(letToken, "Variable must have a type or an initializer.");
    }

    return {
      kind: "LetStatement",
      name,
      type,
      initializer,
      line: letToken.line,
      column: letToken.column,
    };
  }

  private parseConstStatement(): ast.ConstStatement {
    const constToken = this.previous();
    const name = this.parseIdentifier("Expected constant name.");
    
    this.consume(TokenType.COLON, "Expected ':' after constant name.");
    const type = this.parseType();
    
    this.consume(TokenType.EQUALS, "Expected '=' in constant declaration.");
    const initializer = this.parseExpression();
    
    this.consume(TokenType.SEMICOLON, "Expected ';' after constant declaration.");

    return {
      kind: "ConstStatement",
      name,
      type,
      initializer,
      line: constToken.line,
      column: constToken.column,
    };
  }

  private parseReturnStatement(): ast.ReturnStatement {
    const returnToken = this.previous();
    let value: ast.Expression | undefined;
    
    if (!this.check(TokenType.SEMICOLON)) {
      value = this.parseExpression();
    }
    
    this.consume(TokenType.SEMICOLON, "Expected ';' after return value.");
    
    return {
      kind: "ReturnStatement",
      value,
      line: returnToken.line,
      column: returnToken.column,
    };
  }

  private parseBreakStatement(): ast.BreakStatement {
    const breakToken = this.previous();
    this.consume(TokenType.SEMICOLON, "Expected ';' after 'break'.");
    return {
      kind: "BreakStatement",
      line: breakToken.line,
      column: breakToken.column,
    };
  }

  private parseIfStatement(): ast.IfStatement {
    const ifToken = this.previous();
    const condition = this.parseExpression();
    
    this.consume(TokenType.LBRACE, "Expected '{' after if condition.");
    const thenBlock = this.parseBlockBody(this.previous());
    
    let elseBlock: ast.Statement | undefined;
    if (this.match(TokenType.ELSE)) {
      if (this.match(TokenType.IF)) {
        elseBlock = this.parseIfStatement();
      } else {
        this.consume(TokenType.LBRACE, "Expected '{' after else.");
        elseBlock = this.parseBlockBody(this.previous());
      }
    }

    return {
      kind: "IfStatement",
      condition,
      thenBlock,
      elseBlock,
      line: ifToken.line,
      column: ifToken.column,
    };
  }

  private parseWhileStatement(): ast.WhileStatement {
    const whileToken = this.previous();
    const condition = this.parseExpression();
    
    this.consume(TokenType.LBRACE, "Expected '{' after while condition.");
    const body = this.parseBlockBody(this.previous());
    
    return {
      kind: "WhileStatement",
      condition,
      body,
      line: whileToken.line,
      column: whileToken.column,
    };
  }

  private parseForStatement(): ast.Statement {
    const forToken = this.previous();

    // Check if it's C-style `for (let i = 0; ...)` or range-style `for i in 0..10`
    if (this.match(TokenType.LPAREN)) {
      // C-style
      let init: ast.LetStatement | ast.ExpressionStatement | undefined;
      if (this.match(TokenType.SEMICOLON)) {
        init = undefined;
      } else if (this.match(TokenType.LET)) {
        init = this.parseLetStatement(); // parses its own semicolon
      } else {
        init = this.parseExpressionStatement(); // parses its own semicolon
      }

      let condition: ast.Expression | undefined;
      if (!this.check(TokenType.SEMICOLON)) {
        condition = this.parseExpression();
      }
      this.consume(TokenType.SEMICOLON, "Expected ';' after loop condition.");

      let update: ast.Expression | undefined;
      if (!this.check(TokenType.RPAREN)) {
        update = this.parseExpression();
      }
      this.consume(TokenType.RPAREN, "Expected ')' after for clauses.");

      this.consume(TokenType.LBRACE, "Expected '{' after for clauses.");
      const body = this.parseBlockBody(this.previous());

      return {
        kind: "ForStatement",
        init,
        condition,
        update,
        body,
        line: forToken.line,
        column: forToken.column,
      } as ast.ForStatement;
    } else {
      // Range-style: for i in 0..10
      const variable = this.parseIdentifier("Expected loop variable name.");
      this.consume(TokenType.IN, "Expected 'in' after for loop variable.");
      
      const start = this.parseExpression();
      this.consume(TokenType.DOUBLE_DOT, "Expected '..' in for loop range.");
      const end = this.parseExpression();
      
      this.consume(TokenType.LBRACE, "Expected '{' after range.");
      const body = this.parseBlockBody(this.previous());
      
      return {
        kind: "ForInStatement",
        variable,
        start,
        end,
        body,
        line: forToken.line,
        column: forToken.column,
      } as ast.ForInStatement;
    }
  }

  private parseExpressionStatement(): ast.ExpressionStatement {
    const expr = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expected ';' after expression.");
    return {
      kind: "ExpressionStatement",
      expression: expr,
      line: expr.line,
      column: expr.column,
    };
  }

  private parseBlockBody(lbraceToken: Token): ast.Block {
    const statements: ast.Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    this.consume(TokenType.RBRACE, "Expected '}' after block.");
    return {
      kind: "Block",
      statements,
      line: lbraceToken.line,
      column: lbraceToken.column,
    };
  }

  // ── Types ──────────────────────────────────────────────────

  private parseType(): ast.TypeNode {
    const token = this.peek();
    let typeNode: ast.TypeNode;

    // Primitives and User types
    if (this.match(TokenType.I8, TokenType.I16, TokenType.I32, TokenType.I64, 
                   TokenType.F32, TokenType.F64, TokenType.BOOL_TYPE, 
                   TokenType.BYTE, TokenType.STR, TokenType.VOID, TokenType.IDENTIFIER)) {
      const typeToken = this.previous();
      const typeArgs = this.tryParseTypeArgs();
      typeNode = {
        kind: "PrimitiveType",
        name: typeToken.lexeme,
        typeArgs,
        line: typeToken.line,
        column: typeToken.column,
      } as ast.PrimitiveType;
    } 
    // Pointer ptr<T>
    else if (this.match(TokenType.PTR)) {
      const ptrToken = this.previous();
      this.consume(TokenType.LESS, "Expected '<' after 'ptr'.");
      const pointeeType = this.parseType();
      this.consume(TokenType.GREATER, "Expected '>' after pointer type.");
      typeNode = {
        kind: "PointerType",
        pointeeType,
        line: ptrToken.line,
        column: ptrToken.column,
      } as ast.PointerType;
    }
    // Map map<T>
    else if (this.match(TokenType.MAP)) {
      const mapToken = this.previous();
      this.consume(TokenType.LESS, "Expected '<' after 'map'.");
      const valueType = this.parseType();
      this.consume(TokenType.GREATER, "Expected '>' after map value type.");
      typeNode = {
        kind: "MapType",
        valueType,
        line: mapToken.line,
        column: mapToken.column,
      } as ast.MapType;
    }
    // Result<T, E>
    else if (this.match(TokenType.RESULT)) {
      const resultToken = this.previous();
      this.consume(TokenType.LESS, "Expected '<' after 'Result'.");
      const okType = this.parseType();
      this.consume(TokenType.COMMA, "Expected ',' in Result type.");
      const errType = this.parseType();
      this.consume(TokenType.GREATER, "Expected '>' after Result types.");
      typeNode = {
        kind: "ResultType",
        okType,
        errType,
        line: resultToken.line,
        column: resultToken.column,
      } as ast.ResultType;
    } 
    else {
      throw this.error(token, "Expected type.");
    }

    // Array suffixes: [size] or []
    while (this.match(TokenType.LBRACKET)) {
      if (this.match(TokenType.RBRACKET)) {
        // dynamic array []
        typeNode = {
          kind: "ArrayType",
          elementType: typeNode,
          line: typeNode.line,
          column: typeNode.column,
        } as ast.ArrayType;
      } else {
        // fixed size array [size]
        const sizeToken = this.consume(TokenType.INTEGER_LITERAL, "Expected array size.");
        this.consume(TokenType.RBRACKET, "Expected ']' after array size.");
        typeNode = {
          kind: "ArrayType",
          elementType: typeNode,
          size: sizeToken.literal as number,
          line: typeNode.line,
          column: typeNode.column,
        } as ast.ArrayType;
      }
    }

    // Pointer suffix: *
    while (this.match(TokenType.STAR)) {
      typeNode = {
        kind: "PointerType",
        pointeeType: typeNode,
        line: typeNode.line,
        column: typeNode.column,
      } as ast.PointerType;
    }

    // Nullable suffix: ?
    if (this.match(TokenType.QUESTION)) {
      typeNode = {
        kind: "NullableType",
        innerType: typeNode,
        line: typeNode.line,
        column: typeNode.column,
      } as ast.NullableType;
    }

    return typeNode;
  }

  // ── Expressions ────────────────────────────────────────────

  private parseExpression(minPrecedence: Precedence = Precedence.ASSIGNMENT): ast.Expression {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();
      const precedence = this.getPrecedence(token.type);
      
      if (precedence < minPrecedence) {
        break;
      }

      // Handle assignment right-associativity
      const nextMinPrecedence = precedence === Precedence.ASSIGNMENT ? precedence : precedence + 1;

      this.advance(); // consume operator
      left = this.parseInfix(left, token, nextMinPrecedence);
    }

    return left;
  }

  private parsePrefix(): ast.Expression {
    const token = this.advance();

    switch (token.type) {
      case TokenType.INTEGER_LITERAL:
        return { kind: "IntegerLiteral", value: token.literal as number, line: token.line, column: token.column };
      case TokenType.FLOAT_LITERAL:
        return { kind: "FloatLiteral", value: token.literal as number, line: token.line, column: token.column };
      case TokenType.STRING_LITERAL:
        return { kind: "StringLiteral", value: token.literal as string, line: token.line, column: token.column };
      case TokenType.CHAR_LITERAL:
        return { kind: "CharLiteral", value: token.literal as string, line: token.line, column: token.column };
      case TokenType.TRUE:
      case TokenType.FALSE:
        return { kind: "BooleanLiteral", value: token.literal as boolean, line: token.line, column: token.column };
      case TokenType.NULL:
        return { kind: "NullLiteral", line: token.line, column: token.column };
      case TokenType.IDENTIFIER:
        const ident = this.createIdentifier(token);
        const typeArgs = this.tryParseTypeArgs();
        if (typeArgs) ident.typeArgs = typeArgs;
        
        // Check for Struct Literal: Identifier { ... }
        if (this.check(TokenType.LBRACE) && /^[A-Z]/.test(ident.name)) {
          return this.parseStructLiteral(ident, typeArgs);
        }
        return ident;
      case TokenType.LPAREN:
        const expr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after expression.");
        return expr;
      case TokenType.LBRACKET:
        // Array Literal: [e1, e2, e3]
        const elements: ast.Expression[] = [];
        if (!this.check(TokenType.RBRACKET)) {
          do {
            elements.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RBRACKET, "Expected ']' after array elements.");
        return { kind: "ArrayLiteral", elements, line: token.line, column: token.column };
      case TokenType.MINUS:
      case TokenType.BANG:
      case TokenType.NOT:
      case TokenType.STAR:
      case TokenType.AMPERSAND:
        const operand = this.parseExpression(Precedence.UNARY);
        return { kind: "UnaryExpr", operator: token, operand, line: token.line, column: token.column };
      case TokenType.CAST:
        this.consume(TokenType.LESS, "Expected '<' after cast.");
        const targetType = this.parseType();
        this.consume(TokenType.GREATER, "Expected '>' after cast type.");
        this.consume(TokenType.LPAREN, "Expected '(' after cast type.");
        const castExpr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after cast expression.");
        return { kind: "CastExpr", targetType, expr: castExpr, line: token.line, column: token.column };
      case TokenType.ALLOC:
        this.consume(TokenType.LPAREN, "Expected '(' after alloc.");
        const sizeExpr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after alloc size.");
        return { kind: "AllocExpr", sizeExpr, line: token.line, column: token.column };
      case TokenType.FREE:
        this.consume(TokenType.LPAREN, "Expected '(' after free.");
        const freeExpr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after free expr.");
        return {
          kind: "CallExpr",
          callee: this.createIdentifier(token),
          args: [freeExpr],
          line: token.line,
          column: token.column,
        };
      case TokenType.SPAWN:
        const callExpr = this.parseExpression(Precedence.UNARY);
        if (callExpr.kind !== "CallExpr") {
            throw this.error(token, "Expected a function call after 'spawn'.");
        }
        return { kind: "SpawnExpr", call: callExpr as ast.CallExpr, line: token.line, column: token.column };
      case TokenType.CLONE:
        this.consume(TokenType.LPAREN, "Expected '(' after clone.");
        const cloneExpr = this.parseExpression();
        this.consume(TokenType.RPAREN, "Expected ')' after clone expr.");
        return { kind: "CloneExpr", expr: cloneExpr, line: token.line, column: token.column };
      case TokenType.OK:
      case TokenType.ERR:
        // Result constructors: Ok(val), Err(err)
        this.consume(TokenType.LPAREN, `Expected '(' after ${token.lexeme}.`);
        const resExpr = this.parseExpression();
        this.consume(TokenType.RPAREN, `Expected ')' after ${token.lexeme} expression.`);
        // Model as a call to Ok/Err
        return {
          kind: "CallExpr",
          callee: this.createIdentifier(token),
          args: [resExpr],
          line: token.line,
          column: token.column,
        };
      default:
        throw this.error(token, `Unexpected token in expression: '${token.lexeme}'`);
    }
  }

  private parseInfix(left: ast.Expression, operator: Token, minPrecedence: Precedence): ast.Expression {
    switch (operator.type) {
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.PERCENT:
      case TokenType.DOUBLE_EQUALS:
      case TokenType.NOT_EQUALS:
      case TokenType.LESS:
      case TokenType.GREATER:
      case TokenType.LESS_EQUALS:
      case TokenType.GREATER_EQUALS:
      case TokenType.AND_AND:
      case TokenType.AND:
      case TokenType.OR_OR:
      case TokenType.OR:
        const right = this.parseExpression(minPrecedence);
        return { kind: "BinaryExpr", left, operator, right, line: left.line, column: left.column };
      
      case TokenType.EQUALS:
        const value = this.parseExpression(Precedence.ASSIGNMENT);
        return { kind: "AssignmentExpr", target: left, value, line: left.line, column: left.column };

      case TokenType.LPAREN: // CallExpr
        const args: ast.Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')' after arguments.");
        return { kind: "CallExpr", callee: left, args, line: left.line, column: left.column };

      case TokenType.DOT: // FieldAccessExpr
        const field = this.parseIdentifier("Expected property name after '.'.");
        return { kind: "FieldAccessExpr", object: left, field, line: left.line, column: left.column };

      case TokenType.LBRACKET: // IndexAccessExpr
        const index = this.parseExpression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index.");
        return { kind: "IndexAccessExpr", object: left, index, line: left.line, column: left.column };

      case TokenType.PLUS_PLUS:
      case TokenType.MINUS_MINUS:
        return { kind: "PostfixExpr", operand: left, operator, line: left.line, column: left.column };

      default:
        throw this.error(operator, "Internal error: unexpected infix operator.");
    }
  }

  private getPrecedence(type: TokenType): Precedence {
    switch (type) {
      case TokenType.EQUALS: return Precedence.ASSIGNMENT;
      case TokenType.OR_OR:
      case TokenType.OR: return Precedence.OR;
      case TokenType.AND_AND:
      case TokenType.AND: return Precedence.AND;
      case TokenType.DOUBLE_EQUALS:
      case TokenType.NOT_EQUALS: return Precedence.EQUALITY;
      case TokenType.LESS:
      case TokenType.GREATER:
      case TokenType.LESS_EQUALS:
      case TokenType.GREATER_EQUALS: return Precedence.COMPARISON;
      case TokenType.PLUS:
      case TokenType.MINUS: return Precedence.TERM;
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.PERCENT: return Precedence.FACTOR;
      case TokenType.LPAREN:
      case TokenType.DOT:
      case TokenType.LBRACKET:
      case TokenType.PLUS_PLUS:
      case TokenType.MINUS_MINUS: return Precedence.POSTFIX;
      default: return Precedence.NONE;
    }
  }

  private parseStructLiteral(ident: ast.Identifier, typeArgs?: ast.TypeNode[]): ast.StructLiteral {
    const lbrace = this.consume(TokenType.LBRACE, "Expected '{' for struct literal.");
    const fields: ast.StructLiteralField[] = [];

    if (!this.check(TokenType.RBRACE)) {
      do {
        const name = this.parseIdentifier("Expected field name.");
        this.consume(TokenType.COLON, "Expected ':' after field name.");
        const value = this.parseExpression();
        fields.push({ name, value, line: name.line, column: name.column });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RBRACE, "Expected '}' after struct fields.");

    return {
      kind: "StructLiteral",
      name: ident.name,
      typeArgs,
      fields,
      line: ident.line,
      column: ident.column,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private tryParseTypeArgs(): ast.TypeNode[] | undefined {
    const startPos = this.current;
    const errorCount = this.errors.length;
    if (!this.match(TokenType.LESS)) return undefined;

    try {
      const args: ast.TypeNode[] = [];
      do {
        args.push(this.parseType());
      } while (this.match(TokenType.COMMA));

      if (this.match(TokenType.GREATER)) {
        return args;
      }
    } catch {
      // ignore errors, just backtrack
    }
    
    this.current = startPos;
    this.errors.length = errorCount;
    return undefined;
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private error(token: Token, message: string): ParseError {
    const err = new ParseError(token, message);
    this.errors.push(err);
    return err;
  }

  private synchronize(): void {
    this.advance(); // Prevent infinite loops
    while (!this.isAtEnd()) {
      if (this.previous()?.type === TokenType.SEMICOLON) return;

      switch (this.peek().type) {
        case TokenType.STRUCT:
        case TokenType.FUNCTION:
        case TokenType.FN:
        case TokenType.LET:
        case TokenType.CONST:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.FOR:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }

  private parseIdentifier(errorMessage: string = "Expected identifier."): ast.Identifier {
    const token = this.consume(TokenType.IDENTIFIER, errorMessage);
    return this.createIdentifier(token);
  }

  private createIdentifier(token: Token): ast.Identifier {
    return {
      kind: "Identifier",
      name: token.lexeme,
      line: token.line,
      column: token.column,
    };
  }
}
