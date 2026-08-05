// ============================================================
// Vektor — Abstract Syntax Tree (AST)
// ============================================================
// Defines all node types for the Vektor AST.
// ============================================================

import { Token } from "./tokens.js";

// ── Base Node ────────────────────────────────────────────────

export interface ASTNode {
  line: number;
  column: number;
}

// ── Types ────────────────────────────────────────────────────

export type TypeNode =
  | PrimitiveType
  | ArrayType
  | PointerType
  | NullableType
  | ResultType
  | MapType;

export interface PrimitiveType extends ASTNode {
  kind: "PrimitiveType";
  name: string; // e.g., "i32", "str", or custom "Box"
  typeArgs?: TypeNode[]; // e.g., <i32> for Box<i32>
}

export interface ArrayType extends ASTNode {
  kind: "ArrayType";
  elementType: TypeNode;
  size?: number; // defined for fixed-size arrays like i32[5], undefined for dynamic byte[]
}

export interface PointerType extends ASTNode {
  kind: "PointerType";
  pointeeType: TypeNode;
}

export interface NullableType extends ASTNode {
  kind: "NullableType";
  innerType: TypeNode;
}

export interface ResultType extends ASTNode {
  kind: "ResultType";
  okType: TypeNode;
  errType: TypeNode;
}

export interface MapType extends ASTNode {
  kind: "MapType";
  valueType: TypeNode;
}

// ── Expressions ──────────────────────────────────────────────

export type Expression =
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | CharLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | PostfixExpr
  | CallExpr
  | FieldAccessExpr
  | IndexAccessExpr
  | StructLiteral
  | CastExpr
  | AllocExpr
  | CloneExpr
  | ArrayLiteral
  | AssignmentExpr
  | SpawnExpr;

export interface IntegerLiteral extends ASTNode {
  kind: "IntegerLiteral";
  value: number;
}

export interface FloatLiteral extends ASTNode {
  kind: "FloatLiteral";
  value: number;
}

export interface StringLiteral extends ASTNode {
  kind: "StringLiteral";
  value: string;
}

export interface CharLiteral extends ASTNode {
  kind: "CharLiteral";
  value: string;
}

export interface BooleanLiteral extends ASTNode {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface NullLiteral extends ASTNode {
  kind: "NullLiteral";
}

export interface Identifier extends ASTNode {
  kind: "Identifier";
  name: string;
  typeArgs?: TypeNode[];
}

export interface BinaryExpr extends ASTNode {
  kind: "BinaryExpr";
  left: Expression;
  operator: Token; // contains the exact operator, e.g., +, -, &&, ||, ==
  right: Expression;
}

export interface UnaryExpr extends ASTNode {
  kind: "UnaryExpr";
  operator: Token; // e.g., !, -, *, &
  operand: Expression;
}

export interface PostfixExpr extends ASTNode {
  kind: "PostfixExpr";
  operand: Expression;
  operator: Token; // e.g., ++, --
}

export interface CallExpr extends ASTNode {
  kind: "CallExpr";
  callee: Expression;
  typeArgs?: TypeNode[];
  args: Expression[];
}

export interface FieldAccessExpr extends ASTNode {
  kind: "FieldAccessExpr";
  object: Expression;
  field: Identifier;
}

export interface IndexAccessExpr extends ASTNode {
  kind: "IndexAccessExpr";
  object: Expression;
  index: Expression;
}

export interface StructLiteralField extends ASTNode {
  name: Identifier;
  value: Expression;
}

export interface StructLiteral extends ASTNode {
  kind: "StructLiteral";
  name: string; // The struct name
  typeArgs?: TypeNode[];
  fields: StructLiteralField[];
}

export interface CastExpr extends ASTNode {
  kind: "CastExpr";
  targetType: TypeNode;
  expr: Expression;
}

export interface AllocExpr extends ASTNode {
  kind: "AllocExpr";
  sizeExpr: Expression;
}

export interface CloneExpr extends ASTNode {
  kind: "CloneExpr";
  expr: Expression;
}

export interface ArrayLiteral extends ASTNode {
  kind: "ArrayLiteral";
  elements: Expression[];
}

export interface AssignmentExpr extends ASTNode {
  kind: "AssignmentExpr";
  target: Expression; // Must be valid l-value (Identifier, FieldAccess, IndexAccess)
  value: Expression;
}

export interface SpawnExpr extends ASTNode {
  kind: "SpawnExpr";
  call: CallExpr;
}

// ── Statements ───────────────────────────────────────────────

export type Statement =
  | LetStatement
  | ConstStatement
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ForInStatement
  | BreakStatement
  | ExpressionStatement
  | Block;

export interface LetStatement extends ASTNode {
  kind: "LetStatement";
  name: Identifier;
  type?: TypeNode;
  initializer?: Expression;
}

export interface ConstStatement extends ASTNode {
  kind: "ConstStatement";
  name: Identifier;
  type: TypeNode;
  initializer: Expression;
}

export interface ReturnStatement extends ASTNode {
  kind: "ReturnStatement";
  value?: Expression;
}

export interface IfStatement extends ASTNode {
  kind: "IfStatement";
  condition: Expression;
  thenBlock: Block;
  elseBlock?: Statement; // Can be Block or another IfStatement for 'else if'
}

export interface WhileStatement extends ASTNode {
  kind: "WhileStatement";
  condition: Expression;
  body: Block;
}

export interface ForStatement extends ASTNode {
  kind: "ForStatement";
  init?: LetStatement | ExpressionStatement;
  condition?: Expression;
  update?: Expression;
  body: Block;
}

export interface ForInStatement extends ASTNode {
  kind: "ForInStatement";
  variable: Identifier;
  start: Expression;
  end: Expression;
  body: Block;
}

export interface BreakStatement extends ASTNode {
  kind: "BreakStatement";
}

export interface ExpressionStatement extends ASTNode {
  kind: "ExpressionStatement";
  expression: Expression;
}

export interface Block extends ASTNode {
  kind: "Block";
  statements: Statement[];
}

// ── Declarations ─────────────────────────────────────────────

export type Declaration =
  | ImportDecl
  | StructDecl
  | FunctionDecl
  | ConstStatement; // Const can be top-level



export interface ImportDecl extends ASTNode {
  kind: "ImportDecl";
  path: string;
}

export interface StructField extends ASTNode {
  name: Identifier;
  type: TypeNode;
}

export interface StructDecl extends ASTNode {
  kind: "StructDecl";
  name: Identifier;
  typeParams?: Identifier[]; // e.g., <T, U>
  fields: StructField[];
}

export interface FunctionParam extends ASTNode {
  name: Identifier;
  type: TypeNode;
}

export interface FunctionDecl extends ASTNode {
  kind: "FunctionDecl";
  name: Identifier;
  typeParams?: Identifier[]; // e.g., <T>
  params: FunctionParam[];
  returnType?: TypeNode; // undefined if omitted (implies void)
  body: Block;
}

// ── Root ─────────────────────────────────────────────────────

export interface Program extends ASTNode {
  kind: "Program";
  imports: ImportDecl[];
  declarations: Declaration[];
}
