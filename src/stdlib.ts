// ============================================================
// Viktor Script — Standard Library (Phase 6)
// ============================================================
// Single registry for all native builtins. Both the tree-walking
// interpreter and the bytecode VM register functions from here.
// ============================================================

import { readFileSync, writeFileSync, existsSync, readSync, openSync, writeSync, closeSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";
import {
  VKSValue,
  mkInteger, mkFloat, mkBool, mkString, mkNull, mkVoid, mkMap,
  stringify,
} from "./values.js";

// ── Stdlib Paths ─────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the stdlib/ directory (sibling of src/). */
export const STDLIB_ROOT = resolve(__dirname, "..", "stdlib");

/** Known stdlib module files. */
export const STDLIB_MODULES = [
  "io.vks",
  "math.vks",
  "string.vks",
  "os.vks",
  "memory.vks",
  "map.vks",
] as const;

export type StdlibModule = (typeof STDLIB_MODULES)[number];

/**
 * Resolve an import path. Checks relative to the importing file first,
 * then falls back to the stdlib/ directory.
 */
export function resolveImportPath(currentFile: string, importPath: string): string {
  const relative = resolve(dirname(currentFile), importPath);
  if (existsSync(relative)) return relative;

  const stdlibDirect = resolve(STDLIB_ROOT, importPath);
  if (existsSync(stdlibDirect)) return stdlibDirect;

  // Allow `import "io.vks"` → stdlib/io.vks
  const baseName = importPath.replace(/^.*[/\\]/, "");
  const stdlibByName = resolve(STDLIB_ROOT, baseName);
  if (existsSync(stdlibByName)) return stdlibByName;

  return relative;
}

// ── Builtin Metadata ─────────────────────────────────────────

export interface BuiltinSpec {
  name: string;
  module: StdlibModule | "core";
  arity: number;
}

/** Every native builtin name (used to prevent user shadowing warnings, etc.). */
export const BUILTIN_SPECS: BuiltinSpec[] = [
  // io
  { name: "print",      module: "io.vks",     arity: -1 },
  { name: "toString",   module: "io.vks",     arity: 1 },
  { name: "readLine",   module: "io.vks",     arity: 0 },
  { name: "read_file",  module: "io.vks",     arity: 1 },
  { name: "write_file", module: "io.vks",     arity: 2 },
  { name: "parseFloat", module: "io.vks",     arity: 1 },
  { name: "array_new",      module: "io.vks", arity: 0 },
  { name: "array_push",     module: "io.vks", arity: 2 },
  { name: "array_length",   module: "io.vks", arity: 1 },
  { name: "array_push_u16", module: "io.vks", arity: 2 },
  { name: "array_push_u32", module: "io.vks", arity: 2 },
  { name: "array_push_i32", module: "io.vks", arity: 2 },
  { name: "array_push_f64", module: "io.vks", arity: 2 },
  { name: "array_push_str", module: "io.vks", arity: 2 },
  { name: "write_binary",   module: "io.vks", arity: 2 },
  { name: "args_count",     module: "sys.vks", arity: 0 },
  { name: "args_get",       module: "sys.vks", arity: 1 },
  // math
  { name: "sqrt",       module: "math.vks",   arity: 1 },
  { name: "pow",        module: "math.vks",   arity: 2 },
  { name: "sin",        module: "math.vks",   arity: 1 },
  { name: "cos",        module: "math.vks",   arity: 1 },
  { name: "abs",        module: "math.vks",   arity: 1 },
  { name: "floor",      module: "math.vks",   arity: 1 },
  { name: "ceil",       module: "math.vks",   arity: 1 },
  // string
  { name: "charAt",     module: "string.vks", arity: 2 },
  { name: "indexOf",    module: "string.vks", arity: 2 },
  { name: "toUpper",    module: "string.vks", arity: 1 },
  { name: "toLower",    module: "string.vks", arity: 1 },
  { name: "trim",       module: "string.vks", arity: 1 },
  { name: "substring",  module: "string.vks", arity: 3 },
  { name: "parseI32",   module: "string.vks", arity: 1 },
  // os
  { name: "time",       module: "os.vks",     arity: 0 },
  { name: "exit",       module: "os.vks",     arity: 1 },
  // map
  { name: "map_create", module: "map.vks",    arity: 0 },
  { name: "map_set",    module: "map.vks",    arity: 3 },
  { name: "map_get",    module: "map.vks",    arity: 2 },
  { name: "map_has",    module: "map.vks",    arity: 2 },
  { name: "map_delete", module: "map.vks",    arity: 2 },
];

export const BUILTIN_NAMES = new Set(BUILTIN_SPECS.map((s) => s.name));

// ── Shared Helpers ───────────────────────────────────────────

export interface StdlibCallbacks {
  onPrint: (text: string) => void;
  /** VM-only: format runtime values for print/toString. */
  formatValue?: (val: unknown) => string;
}

const defaultCallbacks: StdlibCallbacks = {
  onPrint: (text) => console.log(text),
};

/** Read one line from stdin synchronously (CLI use). */
export function readLineSync(): string {
  try {
    const buf = Buffer.alloc(4096);
    const n = readSync(process.stdin.fd, buf, 0, 4096, null);
    if (n <= 0) return "";
    return buf.toString("utf8", 0, n).replace(/\r?\n$/, "");
  } catch {
    return "";
  }
}

function numVal(v: VKSValue): number {
  if (v.type === "integer" || v.type === "float") return v.value;
  throw new Error(`Expected number, got ${v.type}`);
}

function strVal(v: VKSValue): string {
  if (v.type === "string") return v.value;
  throw new Error(`Expected string, got ${v.type}`);
}

// ── Interpreter Registration ─────────────────────────────────

export function registerInterpreterBuiltins(
  define: (name: string, arity: number, call: (args: VKSValue[]) => VKSValue) => void,
  callbacks: Partial<StdlibCallbacks> = {},
): void {
  const cb = { ...defaultCallbacks, ...callbacks };

  define("print", -1, (args) => {
    const text = args.map(stringify).join(" ");
    cb.onPrint(text);
    return mkVoid();
  });
  define("toString", 1, ([val]) => mkString(stringify(val)));
  define("readLine", 0, () => mkString(readLineSync()));
  define("read_file", 1, ([path]) => {
    try {
      return mkString(readFileSync(strVal(path), "utf-8"));
    } catch {
      return mkNull();
    }
  });
  define("write_file", 2, ([path, content]) => {
    try {
      writeFileSync(strVal(path), strVal(content), "utf-8");
      return mkBool(true);
    } catch {
      return mkBool(false);
    }
  });
  define("parseFloat", 1, ([s]) => {
    const parsed = parseFloat(strVal(s));
    return isNaN(parsed) ? mkFloat(0) : mkFloat(parsed);
  });

  define("sqrt", 1, ([n]) => mkFloat(Math.sqrt(numVal(n))));
  define("pow", 2, ([base, exp]) => mkFloat(Math.pow(numVal(base), numVal(exp))));
  define("sin", 1, ([n]) => mkFloat(Math.sin(numVal(n))));
  define("cos", 1, ([n]) => mkFloat(Math.cos(numVal(n))));
  define("abs", 1, ([n]) => {
    if (n.type === "integer") return mkInteger(Math.abs(n.value));
    return mkFloat(Math.abs(numVal(n)));
  });
  define("floor", 1, ([n]) => mkFloat(Math.floor(numVal(n))));
  define("ceil", 1, ([n]) => mkFloat(Math.ceil(numVal(n))));

  define("charAt", 2, ([s, i]) => mkString(strVal(s).charAt(numVal(i))));
  define("indexOf", 2, ([s, target]) => mkInteger(strVal(s).indexOf(strVal(target))));
  define("toUpper", 1, ([s]) => mkString(strVal(s).toUpperCase()));
  define("toLower", 1, ([s]) => mkString(strVal(s).toLowerCase()));
  define("trim", 1, ([s]) => mkString(strVal(s).trim()));
  define("substring", 3, ([s, start, end]) =>
    mkString(strVal(s).substring(numVal(start), numVal(end))));
  define("parseI32", 1, ([s]) => mkInteger(parseInt(strVal(s), 10) || 0));

  define("time", 0, () => mkFloat(Date.now()));
  define("exit", 1, ([code]) => {
    process.exit(numVal(code));
    return mkVoid();
  });

  define("map_create", 0, () => mkMap());
  define("map_set", 3, ([map, key, val]) => {
    if (map.type === "map" && key.type === "string") {
      map.entries.set(key.value, val);
    }
    return mkVoid();
  });
  define("map_get", 2, ([map, key]) => {
    if (map.type === "map" && key.type === "string") {
      return map.entries.get(key.value) ?? mkNull();
    }
    return mkNull();
  });
  define("map_has", 2, ([map, key]) => {
    if (map.type === "map" && key.type === "string") {
      return mkBool(map.entries.has(key.value));
    }
    return mkBool(false);
  });
  define("map_delete", 2, ([map, key]) => {
    if (map.type === "map" && key.type === "string") {
      return mkBool(map.entries.delete(key.value));
    }
    return mkBool(false);
  });

  // System
  define("args_count", 0, () => {
    return mkInteger(global.__vks_args ? global.__vks_args.length : 0);
  });

  define("args_get", 1, ([index]) => {
    const i = Number(index.value);
    if (global.__vks_args && i >= 0 && i < global.__vks_args.length) {
      return mkString(global.__vks_args[i]);
    }
    return mkNull();
  });

  define("array_length", 1, ([arr]) => {
    if (arr.type === "array") return mkInteger(arr.elements.length);
    return mkInteger(0);
  });
  define("array_push", 2, ([arr, val]) => {
    if (arr.type === "array") arr.elements.push(val);
    return mkNull();
  });
  define("array_push_u16", 2, ([arr, val]) => {
    if (arr.type === "array") {
      const buf = Buffer.alloc(2);
      buf.writeUInt16BE(numVal(val) & 0xffff, 0);
      for (let i = 0; i < 2; i++) arr.elements.push(mkInteger(buf[i]));
    }
    return mkNull();
  });
  define("array_push_u32", 2, ([arr, val]) => {
    if (arr.type === "array") {
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(numVal(val) >>> 0, 0);
      for (let i = 0; i < 4; i++) arr.elements.push(mkInteger(buf[i]));
    }
    return mkNull();
  });
  define("array_push_i32", 2, ([arr, val]) => {
    if (arr.type === "array") {
      const buf = Buffer.alloc(4);
      buf.writeInt32BE(numVal(val) | 0, 0);
      for (let i = 0; i < 4; i++) arr.elements.push(mkInteger(buf[i]));
    }
    return mkNull();
  });
  define("array_push_f64", 2, ([arr, val]) => {
    if (arr.type === "array") {
      const buf = Buffer.alloc(8);
      buf.writeDoubleBE(numVal(val), 0);
      for (let i = 0; i < 8; i++) arr.elements.push(mkInteger(buf[i]));
    }
    return mkNull();
  });
  define("array_push_str", 2, ([arr, val]) => {
    if (arr.type === "array" && val.type === "string") {
      const len = Buffer.byteLength(val.value, "utf-8");
      arr.elements.push(mkInteger((len >> 8) & 0xff));
      arr.elements.push(mkInteger(len & 0xff));
      const buf = Buffer.from(val.value, "utf-8");
      for (let i = 0; i < buf.length; i++) arr.elements.push(mkInteger(buf[i]));
    }
    return mkNull();
  });
  define("write_binary", 2, ([path, arr]) => {
    if (path.type === "string" && arr.type === "array") {
      const buf = Buffer.alloc(arr.elements.length);
      for (let i = 0; i < arr.elements.length; i++) {
        buf.writeUInt8(numVal(arr.elements[i]) & 0xff, i);
      }
      try {
        writeFileSync(path.value, buf);
        return mkBool(true);
      } catch { return mkBool(false); }
    }
    return mkBool(false);
  });
}

// ── VM Registration ──────────────────────────────────────────

export function registerVMBuiltins(
  define: (name: string, arity: number, fn: (...args: any[]) => any) => void,
  callbacks: Partial<StdlibCallbacks> = {},
): void {
  const cb = { ...defaultCallbacks, ...callbacks };

  define("print", -1, (...args) => {
    const fmt = cb.formatValue ?? String;
    cb.onPrint(args.map(fmt).join(" "));
    return null;
  });
  define("toString", 1, (val) => (cb.formatValue ?? String)(val));
  define("readLine", 0, () => readLineSync());
  define("read_file", 1, (path) => {
    if (typeof path !== "string") return null;
    try {
      const content = readFileSync(path, "utf-8");
      return content;
    } catch (e) {
      return null;
    }
  });
  define("write_file", 2, (path, content) => {
    if (typeof path !== "string" || typeof content !== "string") return false;
    try {
      writeFileSync(path, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });
  define("parseFloat", 1, (s) => {
    const parsed = parseFloat(String(s));
    return isNaN(parsed) ? 0 : parsed;
  });

  define("array_new", 0, () => []);
  define("array_length", 1, (arr) => {
    if (Array.isArray(arr)) return arr.length;
    return 0;
  });
  define("array_push", 2, (arr, val) => {
    if (Array.isArray(arr)) arr.push(Number(val));
    return null;
  });
  define("array_push_u16", 2, (arr, val) => {
    if (Array.isArray(arr)) {
      const buf = Buffer.alloc(2);
      buf.writeUInt16BE(Number(val) & 0xffff, 0);
      for (let i = 0; i < 2; i++) arr.push(buf[i]);
    }
    return null;
  });
  define("array_push_u32", 2, (arr, val) => {
    if (Array.isArray(arr)) {
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(Number(val) >>> 0, 0);
      for (let i = 0; i < 4; i++) arr.push(buf[i]);
    }
    return null;
  });
  define("array_push_i32", 2, (arr, val) => {
    if (Array.isArray(arr)) {
      const buf = Buffer.alloc(4);
      buf.writeInt32BE(Number(val) | 0, 0);
      for (let i = 0; i < 4; i++) arr.push(buf[i]);
    }
    return null;
  });
  define("array_push_f64", 2, (arr, val) => {
    if (Array.isArray(arr)) {
      const buf = Buffer.alloc(8);
      buf.writeDoubleBE(Number(val), 0);
      for (let i = 0; i < 8; i++) arr.push(buf[i]);
    }
    return null;
  });
  define("array_push_str", 2, (arr, val) => {
    if (Array.isArray(arr) && typeof val === "string") {
      const len = Buffer.byteLength(val, "utf-8");
      arr.push((len >> 8) & 0xff); // BE: high byte first
      arr.push(len & 0xff);
      const buf = Buffer.from(val, "utf-8");
      for (let i = 0; i < buf.length; i++) arr.push(buf[i]);
    }
    return null;
  });
  define("write_binary", 2, (path, arr) => {
    if (typeof path !== "string" || !Array.isArray(arr)) return false;
    const buf = Buffer.alloc(arr.length);
    for (let i = 0; i < arr.length; i++) buf.writeUInt8(arr[i] & 0xff, i);
    try {
      writeFileSync(path, buf);
      return true;
    } catch { return false; }
  });

  // System
  define("args_count", 0, () => {
    return global.__vks_args ? global.__vks_args.length : 0;
  });

  define("args_get", 1, (index) => {
    const i = Number(index);
    if (global.__vks_args && i >= 0 && i < global.__vks_args.length) {
      return global.__vks_args[i];
    }
    return "";
  });

  define("sqrt", 1, (n) => Math.sqrt(n));
  define("pow", 2, (base, exp) => Math.pow(base, exp));
  define("sin", 1, (n) => Math.sin(n));
  define("cos", 1, (n) => Math.cos(n));
  define("abs", 1, (n) => Math.abs(n));
  define("floor", 1, (n) => Math.floor(n));
  define("ceil", 1, (n) => Math.ceil(n));

  define("charAt", 2, (s, i) => String(s).charAt(i));
  define("charCodeAt", 2, (s, i) => String(s).charCodeAt(i));
  define("indexOf", 2, (s, target) => String(s).indexOf(String(target)));
  define("toUpper", 1, (s) => String(s).toUpperCase());
  define("toLower", 1, (s) => String(s).toLowerCase());
  define("trim", 1, (s) => String(s).trim());
  define("substring", 3, (s, start, end) => String(s).substring(start, end));
  define("parseI32", 1, (s) => parseInt(String(s), 10) || 0);

  define("time", 0, () => Date.now());
  define("exit", 1, (code) => {
    process.exit(code);
    return null;
  });

  define("map_create", 0, () => new Map<string, any>());
  define("map_set", 3, (map, key, val) => {
    if (map instanceof Map && typeof key === "string") map.set(key, val);
    return null;
  });
  define("map_get", 2, (map, key) => {
    if (map instanceof Map && typeof key === "string") return map.get(key) ?? null;
    return null;
  });
  define("map_has", 2, (map, key) => {
    if (map instanceof Map && typeof key === "string") return map.has(key);
    return false;
  });
  define("map_delete", 2, (map, key) => {
    if (map instanceof Map && typeof key === "string") return map.delete(key);
    return false;
  });
}