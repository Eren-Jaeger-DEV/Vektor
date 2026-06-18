// ============================================================
// Viktor Script — Runtime Values
// ============================================================
// Every runtime value in Viktor Script is represented as one
// of these tagged types. The interpreter works exclusively
// with VKSValue instances.
// ============================================================

import { FunctionDecl } from "./ast.js";
import { Environment } from "./environment.js";

// ── Value Tags ───────────────────────────────────────────────

export type VKSValueType =
  | "integer"
  | "float"
  | "bool"
  | "byte"
  | "string"
  | "null"
  | "array"
  | "struct"
  | "result"
  | "pointer"
  | "void"
  | "function"
  | "map";

// ── Value Types ──────────────────────────────────────────────

export interface VKSInteger {
  type: "integer";
  value: number;
  /** The declared bit width (8, 16, 32, 64) */
  bitWidth: 8 | 16 | 32 | 64;
}

export interface VKSFloat {
  type: "float";
  value: number;
  /** The declared precision (32, 64) */
  bitWidth: 32 | 64;
}

export interface VKSBool {
  type: "bool";
  value: boolean;
}

export interface VKSByte {
  type: "byte";
  value: number; // 0–255
}

export interface VKSString {
  type: "string";
  value: string;
}

export interface VKSNull {
  type: "null";
}

export interface VKSArray {
  type: "array";
  elements: VKSValue[];
}

export interface VKSStruct {
  type: "struct";
  structName: string;
  fields: Map<string, VKSValue>;
}

export interface VKSResult {
  type: "result";
  isOk: boolean;
  value: VKSValue; // The Ok or Err payload
}

export interface VKSPointer {
  type: "pointer";
  address: number;
}

export interface VKSVoid {
  type: "void";
}

export interface VKSMap {
  type: "map";
  entries: Map<string, VKSValue>;
}

/** A user-defined function captured with its defining environment. */
export interface VKSFunction {
  type: "function";
  declaration: FunctionDecl;
  closure: Environment;
}

/** A built-in function implemented natively in TypeScript. */
export interface VKSBuiltinFunction {
  type: "function";
  name: string;
  arity: number; // -1 for variadic
  call: (args: VKSValue[]) => VKSValue;
}

// ── Union Type ───────────────────────────────────────────────

export type VKSValue =
  | VKSInteger
  | VKSFloat
  | VKSBool
  | VKSByte
  | VKSString
  | VKSNull
  | VKSArray
  | VKSStruct
  | VKSResult
  | VKSPointer
  | VKSVoid
  | VKSMap
  | VKSFunction
  | VKSBuiltinFunction;

// ── Constructors ─────────────────────────────────────────────

export function mkInteger(value: number, bitWidth: 8 | 16 | 32 | 64 = 32): VKSInteger {
  return { type: "integer", value, bitWidth };
}

export function mkFloat(value: number, bitWidth: 32 | 64 = 64): VKSFloat {
  return { type: "float", value, bitWidth };
}

export function mkBool(value: boolean): VKSBool {
  return { type: "bool", value };
}

export function mkByte(value: number): VKSByte {
  return { type: "byte", value: value & 0xFF };
}

export function mkString(value: string): VKSString {
  return { type: "string", value };
}

export function mkNull(): VKSNull {
  return { type: "null" };
}

export function mkArray(elements: VKSValue[]): VKSArray {
  return { type: "array", elements };
}

export function mkStruct(structName: string, fields: Map<string, VKSValue>): VKSStruct {
  return { type: "struct", structName, fields };
}

export function mkResult(isOk: boolean, value: VKSValue): VKSResult {
  return { type: "result", isOk, value };
}

export function mkPointer(address: number): VKSPointer {
  return { type: "pointer", address };
}

export function mkVoid(): VKSVoid {
  return { type: "void" };
}

export function mkMap(): VKSMap {
  return { type: "map", entries: new Map() };
}

// ── Type Guards ──────────────────────────────────────────────

export function isCallable(value: VKSValue): value is VKSFunction | VKSBuiltinFunction {
  return value.type === "function";
}

export function isBuiltin(value: VKSValue): value is VKSBuiltinFunction {
  return value.type === "function" && "call" in value;
}

export function isUserFunction(value: VKSValue): value is VKSFunction {
  return value.type === "function" && "declaration" in value;
}

export function isTruthy(value: VKSValue): boolean {
  switch (value.type) {
    case "bool":
      return value.value;
    case "null":
      return false;
    case "integer":
      return value.value !== 0;
    case "float":
      return value.value !== 0;
    case "byte":
      return value.value !== 0;
    case "string":
      return value.value.length > 0;
    case "pointer":
      return value.address !== 0;
    case "void":
      return false;
    default:
      return true;
  }
}

// ── Stringify ────────────────────────────────────────────────

export function stringify(value: VKSValue): string {
  switch (value.type) {
    case "integer":
      return String(value.value);
    case "float": {
      const s = String(value.value);
      // Ensure floats always show a decimal point
      return s.includes(".") ? s : s + ".0";
    }
    case "bool":
      return value.value ? "true" : "false";
    case "byte":
      return String.fromCharCode(value.value);
    case "string":
      return value.value;
    case "null":
      return "null";
    case "array":
      return "[" + value.elements.map(stringify).join(", ") + "]";
    case "struct": {
      const fields = Array.from(value.fields.entries())
        .map(([k, v]) => `${k}: ${stringify(v)}`)
        .join(", ");
      return `${value.structName} { ${fields} }`;
    }
    case "result":
      return value.isOk
        ? `Ok(${stringify(value.value)})`
        : `Err(${stringify(value.value)})`;
    case "pointer":
      return `ptr<0x${value.address.toString(16)}>`;
    case "void":
      return "void";
    case "map": {
      const entries = Array.from(value.entries.entries())
        .map(([k, v]) => `"${k}": ${stringify(v)}`)
        .join(", ");
      return `map { ${entries} }`;
    }
    case "function":
      if ("name" in value && typeof value.name === "string") {
        return `<builtin fn ${value.name}>`;
      }
      return `<fn ${(value as VKSFunction).declaration.name.name}>`;
  }
}

// ── Deep Clone ───────────────────────────────────────────────

export function deepClone(value: VKSValue): VKSValue {
  switch (value.type) {
    case "integer":
      return { ...value };
    case "float":
      return { ...value };
    case "bool":
      return { ...value };
    case "byte":
      return { ...value };
    case "string":
      return { ...value };
    case "null":
      return mkNull();
    case "void":
      return mkVoid();
    case "array":
      return mkArray(value.elements.map(deepClone));
    case "struct": {
      const newFields = new Map<string, VKSValue>();
      for (const [k, v] of value.fields) {
        newFields.set(k, deepClone(v));
      }
      return mkStruct(value.structName, newFields);
    }
    case "result":
      return mkResult(value.isOk, deepClone(value.value));
    case "pointer":
      return mkPointer(value.address);
    case "map": {
      const newMap = mkMap();
      for (const [k, v] of value.entries) {
        newMap.entries.set(k, deepClone(v));
      }
      return newMap;
    }
    case "function":
      // Functions are not cloneable — return as-is
      return value;
  }
}
