// ============================================================
// Vektor — Bytecode Opcodes
// ============================================================
// Every instruction the bytecode compiler can emit.
// Each opcode is a single byte. Operands follow inline.
// ============================================================

/**
 * All bytecode opcodes for the Vektor VM.
 * Values are assigned explicitly for stability across versions.
 */
export enum Op {
  // ── Constants & Literals ─────────────────────────────────
  /** Push constant from pool. Operand: u16 index */
  CONST       = 0x01,
  /** Push null */
  NULL        = 0x02,
  /** Push true */
  TRUE        = 0x03,
  /** Push false */
  FALSE       = 0x04,

  // ── Arithmetic ───────────────────────────────────────────
  /** a + b (also string concat) */
  ADD         = 0x10,
  /** a - b */
  SUB         = 0x11,
  /** a * b */
  MUL         = 0x12,
  /** a / b */
  DIV         = 0x13,
  /** a % b */
  MOD         = 0x14,
  /** -a */
  NEG         = 0x15,

  // ── Comparison & Logic ───────────────────────────────────
  /** a == b */
  EQ          = 0x20,
  /** a != b */
  NEQ         = 0x21,
  /** a < b */
  LT          = 0x22,
  /** a > b */
  GT          = 0x23,
  /** a <= b */
  LTE         = 0x24,
  /** a >= b */
  GTE         = 0x25,
  /** !a */
  NOT         = 0x26,

  // ── Variables ────────────────────────────────────────────
  /** Push local variable. Operand: u16 slot */
  LOAD_LOCAL  = 0x30,
  /** Pop and store to local. Operand: u16 slot */
  STORE_LOCAL = 0x31,
  /** Push global by name. Operand: u16 constant pool index */
  LOAD_GLOBAL = 0x32,
  /** Pop and store to global. Operand: u16 constant pool index */
  STORE_GLOBAL = 0x33,

  // ── Control Flow ─────────────────────────────────────────
  /** Unconditional forward jump. Operand: u16 offset */
  JUMP        = 0x40,
  /** Jump if top is falsy (pops). Operand: u16 offset */
  JUMP_IF_FALSE = 0x41,
  /** Jump if top is truthy (pops). Operand: u16 offset */
  JUMP_IF_TRUE = 0x42,
  /** Jump backward (for loops). Operand: u16 offset */
  LOOP        = 0x43,

  // ── Functions ────────────────────────────────────────────
  /** Call function. Operand: u8 argCount */
  CALL        = 0x50,
  /** Return from function */
  RETURN      = 0x51,

  // ── Structs ──────────────────────────────────────────────
  /** Create struct. Operands: u16 nameIdx, u8 fieldCount */
  NEW_STRUCT  = 0x60,
  /** Read field. Operand: u16 nameIdx */
  GET_FIELD   = 0x61,
  /** Write field. Operand: u16 nameIdx */
  SET_FIELD   = 0x62,

  // ── Arrays ───────────────────────────────────────────────
  /** Create array from stack. Operand: u16 count */
  NEW_ARRAY   = 0x70,
  /** Read array/pointer index: obj, idx → value */
  GET_INDEX   = 0x71,
  /** Write array/pointer index: obj, idx, value → value */
  SET_INDEX   = 0x72,

  // ── Memory & Pointers ───────────────────────────────────
  /** Allocate heap. size → ptr */
  ALLOC       = 0x80,
  /** Free heap. ptr → */
  FREE        = 0x81,
  /** Address of local. Operand: u16 slot → ptr */
  ADDR_OF     = 0x82,
  /** Dereference pointer. ptr → value */
  DEREF       = 0x83,
  /** Write through pointer. ptr, value → value */
  DEREF_SET   = 0x84,

  // ── Special ──────────────────────────────────────────────
  /** Wrap in Ok(). value → result */
  MAKE_OK     = 0x90,
  /** Wrap in Err(). value → result */
  MAKE_ERR    = 0x91,
  /** Type cast. Operand: u16 typeIdx (constant pool). value → value */
  CAST        = 0x92,
  /** Deep clone. value → cloned */
  CLONE       = 0x93,
  /** Print. Operand: u8 argCount. values... → */
  PRINT       = 0x94,

  // ── Stack ────────────────────────────────────────────────
  /** Discard top of stack */
  POP         = 0xA0,
  /** Duplicate top of stack */
  DUP         = 0xA1,

  // ── Postfix ──────────────────────────────────────────────
  /** Postfix ++. Operand: u16 slot → oldValue */
  INC         = 0xB0,
  /** Postfix --. Operand: u16 slot → oldValue */
  DEC         = 0xB1,

  // ── Halt ─────────────────────────────────────────────────
  /** Stop execution */
  HALT        = 0xFF,
}

// ── Opcode Metadata ──────────────────────────────────────────

export interface OpcodeInfo {
  /** Human-readable name */
  name: string;
  /** Number of bytes in operands (after the opcode byte) */
  operandBytes: number;
}

/**
 * Metadata for every opcode — used by the disassembler.
 */
export const OPCODE_INFO: ReadonlyMap<Op, OpcodeInfo> = new Map([
  // Constants
  [Op.CONST,          { name: "CONST",          operandBytes: 2 }],
  [Op.NULL,           { name: "NULL",           operandBytes: 0 }],
  [Op.TRUE,           { name: "TRUE",           operandBytes: 0 }],
  [Op.FALSE,          { name: "FALSE",          operandBytes: 0 }],

  // Arithmetic
  [Op.ADD,            { name: "ADD",            operandBytes: 0 }],
  [Op.SUB,            { name: "SUB",            operandBytes: 0 }],
  [Op.MUL,            { name: "MUL",            operandBytes: 0 }],
  [Op.DIV,            { name: "DIV",            operandBytes: 0 }],
  [Op.MOD,            { name: "MOD",            operandBytes: 0 }],
  [Op.NEG,            { name: "NEG",            operandBytes: 0 }],

  // Comparison & Logic
  [Op.EQ,             { name: "EQ",             operandBytes: 0 }],
  [Op.NEQ,            { name: "NEQ",            operandBytes: 0 }],
  [Op.LT,             { name: "LT",             operandBytes: 0 }],
  [Op.GT,             { name: "GT",             operandBytes: 0 }],
  [Op.LTE,            { name: "LTE",            operandBytes: 0 }],
  [Op.GTE,            { name: "GTE",            operandBytes: 0 }],
  [Op.NOT,            { name: "NOT",            operandBytes: 0 }],

  // Variables
  [Op.LOAD_LOCAL,     { name: "LOAD_LOCAL",     operandBytes: 2 }],
  [Op.STORE_LOCAL,    { name: "STORE_LOCAL",    operandBytes: 2 }],
  [Op.LOAD_GLOBAL,    { name: "LOAD_GLOBAL",    operandBytes: 2 }],
  [Op.STORE_GLOBAL,   { name: "STORE_GLOBAL",   operandBytes: 2 }],

  // Control flow
  [Op.JUMP,           { name: "JUMP",           operandBytes: 2 }],
  [Op.JUMP_IF_FALSE,  { name: "JUMP_IF_FALSE",  operandBytes: 2 }],
  [Op.JUMP_IF_TRUE,   { name: "JUMP_IF_TRUE",   operandBytes: 2 }],
  [Op.LOOP,           { name: "LOOP",           operandBytes: 2 }],

  // Functions
  [Op.CALL,           { name: "CALL",           operandBytes: 1 }],
  [Op.RETURN,         { name: "RETURN",         operandBytes: 0 }],

  // Structs
  [Op.NEW_STRUCT,     { name: "NEW_STRUCT",     operandBytes: 3 }], // u16 + u8
  [Op.GET_FIELD,      { name: "GET_FIELD",      operandBytes: 2 }],
  [Op.SET_FIELD,      { name: "SET_FIELD",      operandBytes: 2 }],

  // Arrays
  [Op.NEW_ARRAY,      { name: "NEW_ARRAY",      operandBytes: 2 }],
  [Op.GET_INDEX,      { name: "GET_INDEX",      operandBytes: 0 }],
  [Op.SET_INDEX,      { name: "SET_INDEX",      operandBytes: 0 }],

  // Memory
  [Op.ALLOC,          { name: "ALLOC",          operandBytes: 0 }],
  [Op.FREE,           { name: "FREE",           operandBytes: 0 }],
  [Op.ADDR_OF,        { name: "ADDR_OF",        operandBytes: 2 }],
  [Op.DEREF,          { name: "DEREF",          operandBytes: 0 }],
  [Op.DEREF_SET,      { name: "DEREF_SET",      operandBytes: 0 }],

  // Special
  [Op.MAKE_OK,        { name: "MAKE_OK",        operandBytes: 0 }],
  [Op.MAKE_ERR,       { name: "MAKE_ERR",       operandBytes: 0 }],
  [Op.CAST,           { name: "CAST",           operandBytes: 2 }],
  [Op.CLONE,          { name: "CLONE",          operandBytes: 0 }],
  [Op.PRINT,          { name: "PRINT",          operandBytes: 1 }],

  // Stack
  [Op.POP,            { name: "POP",            operandBytes: 0 }],
  [Op.DUP,            { name: "DUP",            operandBytes: 0 }],

  // Postfix
  [Op.INC,            { name: "INC",            operandBytes: 2 }],
  [Op.DEC,            { name: "DEC",            operandBytes: 2 }],

  // Halt
  [Op.HALT,           { name: "HALT",           operandBytes: 0 }],
]);
