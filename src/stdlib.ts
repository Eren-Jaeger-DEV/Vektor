// ============================================================
// Viktor Script — Standard Library (Phase 6)
// ============================================================
// Single registry for all native builtins. Both the tree-walking
// interpreter and the bytecode VM register functions from here.
// ============================================================

import { readFileSync, writeFileSync, existsSync, readSync, openSync, writeSync, closeSync, mkdirSync, readdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";
import { execSync } from "child_process";
import {
  VKSValue,
  mkInteger, mkFloat, mkBool, mkString, mkNull, mkVoid, mkMap, mkArray,
  stringify,
} from "./values.js";
import { RuntimeError } from "./errors.js";

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
export function resolveImportPath(currentFile: string, importPath: string, projectRoot: string = process.cwd()): string {
  const isRelative = importPath.startsWith("./") || importPath.startsWith("../") || importPath.startsWith("/");

  if (isRelative) {
    const relative = resolve(dirname(currentFile), importPath);
    if (existsSync(relative)) return relative;
    return relative;
  }

  const stdlibDirect = resolve(STDLIB_ROOT, importPath);
  if (existsSync(stdlibDirect)) return stdlibDirect;

  // Allow `import "io.vks"` → stdlib/io.vks
  const baseName = importPath.replace(/^.*[/\\]/, "");
  const stdlibByName = resolve(STDLIB_ROOT, baseName);
  if (existsSync(stdlibByName)) return stdlibByName;

  // Package manager resolution
  const packageName = importPath.replace(/\.vks$/, "");
  try {
    return resolvePackageEntry(projectRoot, packageName);
  } catch (e) {
    // Fallback to old relative behavior
    return resolve(dirname(currentFile), importPath);
  }
}

export function resolvePackageEntry(projectRoot: string, packageName: string): string {
  const pkgDir = resolve(projectRoot, "vks_modules", packageName);
  const pkgManifestPath = resolve(pkgDir, "viktor.json");

  if (existsSync(pkgManifestPath)) {
    const pkgManifest = JSON.parse(readFileSync(pkgManifestPath, "utf-8"));
    return resolve(pkgDir, pkgManifest.entry);
  }

  // Fallback convention if the package has no manifest: look for index.vks
  const fallback = resolve(pkgDir, "index.vks");
  if (existsSync(fallback)) return fallback;

  throw new Error(
    `Cannot resolve package "${packageName}" — no viktor.json or index.vks found in ${pkgDir}`
  );
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
  { name: "resolve_import", module: "sys.vks", arity: 2 },
  { name: "mkdir",          module: "sys.vks", arity: 1 },
  { name: "file_exists",    module: "sys.vks", arity: 1 },
  { name: "list_dir",       module: "sys.vks", arity: 1 },
  { name: "shell_exec",     module: "sys.vks", arity: 1 },
  { name: "parse_json",     module: "sys.vks", arity: 1 },
  { name: "stringify_json", module: "sys.vks", arity: 1 },
  { name: "system",         module: "sys.vks", arity: 1 },
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
  { name: "str_length", module: "string.vks", arity: 1 },
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
  { name: "map_keys",   module: "map.vks",    arity: 1 },
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

export function jsToVks(val: any): VKSValue {
  if (val === null || val === undefined) return mkNull();
  if (typeof val === "boolean") return mkBool(val);
  if (typeof val === "number") return Number.isInteger(val) ? mkInteger(val) : mkFloat(val);
  if (typeof val === "string") return mkString(val);
  if (Array.isArray(val)) return mkArray(val.map(jsToVks));
  if (typeof val === "object") {
    const map = mkMap();
    for (const key of Object.keys(val)) {
      map.entries.set(key, jsToVks(val[key]));
    }
    return map;
  }
  return mkNull();
}

export function vksToJs(val: VKSValue): any {
  switch (val.type) {
    case "null": return null;
    case "void": return null;
    case "bool": return val.value;
    case "integer": return val.value;
    case "float": return val.value;
    case "byte": return val.value;
    case "string": return val.value;
    case "array": return val.elements.map(vksToJs);
    case "map": {
      const obj: any = {};
      for (const [k, v] of val.entries) {
        obj[k] = vksToJs(v);
      }
      return obj;
    }
    default: return null;
  }
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
  define("str_length", 1, ([s]) => mkInteger(strVal(s).length));
  define("parseI32", 1, ([s]) => mkInteger(parseInt(strVal(s), 10) || 0));

  define("time", 0, () => mkFloat(Date.now()));
  define("exit", 1, ([code]) => {
    process.exit(numVal(code));
    return mkVoid();
  });
  define("panic", 1, ([msg]) => {
    throw new RuntimeError(strVal(msg), 0, 0);
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
  define("map_keys", 1, ([map]) => {
    if (map.type === "map") {
      return mkArray(Array.from(map.entries.keys()).map(mkString));
    }
    return mkArray([]);
  });

  // Concurrency (Stubs, Native LLVM Only)
  const concurrencyError = () => { throw new RuntimeError("Concurrency builtins require native compilation. Use --llvm.", 0, 0); };
  define("thread_join", 1, concurrencyError);
  define("mutex_create", 0, concurrencyError);
  define("mutex_lock", 1, concurrencyError);
  define("mutex_unlock", 1, concurrencyError);
  define("mutex_destroy", 1, concurrencyError);

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

  define("resolve_import", 2, ([currentFile, importStr]) => {
    if (currentFile.type === "string" && importStr.type === "string") {
      const resolved = resolveImportPath(currentFile.value, importStr.value, process.cwd());
      return mkString(resolved);
    }
    return mkNull();
  });

  define("mkdir", 1, ([path]) => {
    try {
      mkdirSync(strVal(path), { recursive: true });
      return mkVoid();
    } catch { return mkVoid(); }
  });

  define("file_exists", 1, ([path]) => {
    try {
      return mkBool(existsSync(strVal(path)));
    } catch { return mkBool(false); }
  });

  define("list_dir", 1, ([path]) => {
    try {
      const files = readdirSync(strVal(path));
      return mkArray(files.map(mkString));
    } catch { return mkArray([]); }
  });

  define("shell_exec", 1, ([cmd]) => {
    try {
      execSync(strVal(cmd), { stdio: "inherit" });
      return mkInteger(0);
    } catch (e: any) {
      return mkInteger(e.status ?? 1);
    }
  });

  define("parse_json", 1, ([text]) => {
    try {
      const obj = JSON.parse(strVal(text));
      return jsToVks(obj);
    } catch (e) { console.error("parse_json err", e); return mkNull(); }
  });

  define("stringify_json", 1, ([val]) => {
    try {
      return mkString(JSON.stringify(vksToJs(val), null, 2));
    } catch { return mkString(""); }
  });

  define("delete_file", 1, ([path]) => {
    try {
      rmSync(strVal(path), { recursive: true, force: true });
      return mkVoid();
    } catch { return mkVoid(); }
  });

  define("get_env", 1, ([name]) => {
    try {
      const val = process.env[strVal(name)];
      return val !== undefined ? mkString(val) : mkNull();
    } catch { return mkNull(); }
  });

  define("get_args", 0, () => {
    try {
      return mkArray(((global as any).__vks_args || []).map((a: string) => mkString(a)));
    } catch { return mkArray([]); }
  });

  define("str_split", 2, ([s, sep]) => {
    try {
      const parts = strVal(s).split(strVal(sep));
      return mkArray(parts.map(mkString));
    } catch { return mkArray([]); }
  });

  define("str_replace", 3, ([s, find, replacement]) => {
    try {
      return mkString(strVal(s).replaceAll(strVal(find), strVal(replacement)));
    } catch { return mkString(""); }
  });

  define("free_str_array", 1, ([arr]) => mkVoid());

  define("format", -1, (args) => {
    try {
      if (args.length === 0) return mkString("");
      const template = strVal(args[0]);
      let argIndex = 1;
      const formatted = template.replace(/{}/g, () => {
        if (argIndex < args.length) {
          return stringify(args[argIndex++]);
        }
        return "{}";
      });
      return mkString(formatted);
    } catch { return mkString(""); }
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

  define("resolve_import", 2, (currentFile, importStr) => {
    if (typeof currentFile === "string" && typeof importStr === "string") {
      return resolveImportPath(currentFile, importStr, process.cwd());
    }
    return "";
  });

  define("mkdir", 1, (path) => {
    try {
      if (typeof path === "string") mkdirSync(path, { recursive: true });
    } catch {}
    return null;
  });

  define("file_exists", 1, (path) => {
    try {
      return typeof path === "string" ? existsSync(path) : false;
    } catch { return false; }
  });

  define("list_dir", 1, (path) => {
    try {
      if (typeof path === "string") return readdirSync(path);
      return [];
    } catch { return []; }
  });

  define("system", 1, (cmd) => {
    try {
      execSync(cmd, { stdio: "inherit" });
      return 0;
    } catch (e: any) {
      return e.status || 1;
    }
  });

  define("parse_json", 1, (text) => {
    try {
      if (typeof text === "string") {
        const obj = JSON.parse(text);
        const jsToVm = (val: any): any => {
          if (val === null || val === undefined) return null;
          if (Array.isArray(val)) return val.map(jsToVm);
          if (typeof val === "object") {
            const map = new Map<string, any>();
            for (const key of Object.keys(val)) {
              map.set(key, jsToVm(val[key]));
            }
            return map;
          }
          return val; // string, number, boolean
        };
        return jsToVm(obj);
      }
    } catch {}
    return null;
  });

  define("stringify_json", 1, (val) => {
    try {
      // In VM, values are just raw JS primitives, arrays, maps.
      const vmToJs = (v: any): any => {
        if (v instanceof Map) {
          const obj: any = {};
          for (const [k, v2] of v.entries()) obj[k] = vmToJs(v2);
          return obj;
        }
        if (Array.isArray(v)) return v.map(vmToJs);
        return v;
      };
      return JSON.stringify(vmToJs(val), null, 2);
    } catch { return ""; }
  });

  define("delete_file", 1, (path) => {
    try {
      if (typeof path === "string") rmSync(path, { recursive: true, force: true });
    } catch {}
    return null;
  });

  define("get_env", 1, (name) => {
    try {
      if (typeof name === "string") {
        const val = process.env[name];
        return val !== undefined ? val : null;
      }
    } catch {}
    return null;
  });

  define("get_args", 0, () => {
    try {
      if (global.__vks_args) return [...global.__vks_args];
    } catch {}
    return [];
  });

  define("str_split", 2, (s, sep) => {
    try {
      if (typeof s === "string" && typeof sep === "string") {
        return s.split(sep);
      }
    } catch {}
    return [];
  });

  define("str_replace", 3, (s, find, replacement) => {
    try {
      if (typeof s === "string" && typeof find === "string" && typeof replacement === "string") {
        return s.replaceAll(find, replacement);
      }
    } catch {}
    return "";
  });

  define("free_str_array", 1, (arr) => null);

  define("format", -1, (...args) => {
    try {
      if (args.length === 0) return "";
      const template = String(args[0]);
      let argIndex = 1;
      const fmt = cb.formatValue ?? String;
      return template.replace(/{}/g, () => {
        if (argIndex < args.length) {
          return fmt(args[argIndex++]);
        }
        return "{}";
      });
    } catch { return ""; }
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
  define("str_length", 1, (s) => String(s).length);
  define("parseI32", 1, (s) => parseInt(String(s), 10) || 0);

  define("time", 0, () => Date.now());
  define("exit", 1, (code) => {
    process.exit(code);
    return null;
  });
  define("panic", 1, (msg) => {
    throw new RuntimeError(String(msg), 0, 0);
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
  define("map_keys", 1, (map) => {
    if (map instanceof Map) return Array.from(map.keys());
    return [];
  });

  // Concurrency (Stubs, Native LLVM Only)
  const concurrencyError = () => { throw new RuntimeError("Concurrency builtins require native compilation. Use --llvm.", 0, 0); };
  define("thread_join", 1, concurrencyError);
  define("mutex_create", 0, concurrencyError);
  define("mutex_lock", 1, concurrencyError);
  define("mutex_unlock", 1, concurrencyError);
  define("mutex_destroy", 1, concurrencyError);
}