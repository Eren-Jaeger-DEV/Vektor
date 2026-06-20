# Viktor Script Full Roadmap (Phases 1–20)
### Path from Inception to Full Independence

**Status as of this document:** Phases 1–14 complete. Core language implemented, self-hosting achieved, LLVM native compilation verified end-to-end, and advanced networking and concurrency are functional. Phase 15 (Cross-Platform Native Compile) is next.

---

## Part 1: The Foundation (Completed)

Phases 1–8 focused on building a fully functional language and verifying its execution across interpreted, bytecode, and native environments.

### Phase 1 — Lexer ✅
- **Focus:** Tokenize `.vks` source code.
- **Deliverable:** Read raw text and produce a clean stream of meaningful tokens (`LET`, `IDENTIFIER`, `LBRACE`, etc.) to feed the parser.

### Phase 2 — Parser ✅
- **Focus:** Build Abstract Syntax Tree (AST).
- **Deliverable:** Consume tokens and construct a structured tree representing the program's logic (variable declarations, binary expressions, loops, structs).

### Phase 3 — AST Interpreter ✅
- **Focus:** Walk AST and execute (interpreted mode).
- **Deliverable:** The `--run-ast` command, which allows immediate execution of `.vks` files purely by traversing the AST dynamically in memory.

### Phase 4 — Bytecode Compiler ✅
- **Focus:** Compile AST to optimized bytecode.
- **Deliverable:** Produce `.vkb` (Viktor Bytecode) files using a custom opcode instruction set designed for speed and safety.

### Phase 5 — Virtual Machine ✅
- **Focus:** Execute bytecode.
- **Deliverable:** The stack-based `VM` that rapidly consumes `.vkb` instructions to execute compiled programs faster than AST interpretation.

### Phase 6 — Core Standard Library ✅
- **Focus:** Foundational system interactions.
- **Deliverable:** Initial implementation of `io` (printing), `memory` (alloc/free), `math`, and basic types to make the language actually usable for real tasks.

### Phase 7 — Self-Hosting Compiler ✅
- **Focus:** Write the Viktor Script compiler *in* Viktor Script.
- **Deliverable:** The `vks-compiler/` directory containing a lexer, parser, and compiler written natively in `.vks`. Bootstrapped using the original TypeScript compiler, proving the language is Turing complete and expressive enough to compile itself.

### Phase 8 — Native LLVM Compilation ✅
- **Focus:** Native binary generation.
- **Deliverable:** An LLVM IR emitter that transforms the AST into `test.ll`, which Clang/GCC links against a lightweight `runtime.c` to produce bare-metal, unmanaged executables (`.exe`).

---

## Part 2: The Ecosystem (In Progress)

Phases 9–20 build an *ecosystem*. The test for "done" changes:

> **The ultimate test:** "Can someone else install this on a machine with nothing on it, write something real, and ship it — without ever touching Node.js or your source repo?"

Every phase below is in service of that finish line.

---

## Phase 9 — Package Manager: Completion & Self-Hosting ✅

### 9.1 — Status
- `viktor.json` manifest format defined and working
- `vks_modules/` resolution working for the **AST interpreter** (`--run-ast`)
- TypeScript-based `vks init` / `vks install` working
- Self-hosted `resolve_import` intrinsic implemented

---

## Phase 10 — Generics ✅

### 10.1 — Design choice: Monomorphization
Same approach C++ templates and Rust generics use: **the compiler generates one concrete version per type combination actually used in the program**, rather than one generic version that works for any type at runtime.

### 10.2 — Status
- `<T>` syntax implemented on struct and function declarations.
- Monomorphization pass built into the compiler.
- Each backend consumes the *already-specialized* AST — no backend needs to know generics existed.

---

## Phase 11 — Standard Library Expansion ✅

File system functions, JSON, and string utilities implemented.
- `mkdir(path: str)`, `file_exists(path: str)`, `list_dir(path: str)`, `delete_file(path: str)`
- `parse_json(text: str)`, `stringify_json(val: JsonValue)`
- `get_env(name: str)`, `get_args()`
- `str_split(s: str, sep: str)`, `str_replace(s: str, find: str, with: str)`

---

## Phase 12: Error Handling & Debugging ✅

- Rust-style error formatting (pointers to source code)
- Call stack unwinding for `RuntimeError`
- Panic tracing for LLVM compiled native executables
- Stack traces correctly resolve source spans (start/end positions) during native and VM execution crashes.

---

## Phase 13 — Concurrency ✅

### 13.1 — Scope: OS threads only
Real OS-level parallelism via `runtime.c` wrapping `pthread` (Linux/macOS) and `CreateThread` (Windows) behind one shared interface. No global interpreter lock.

### 13.2 — Primitives Implemented
- `spawn fn_name(args)` → returns a `Thread` handle
- `thread.join() -> void`
- `mutex_create() -> Mutex`
- `mutex_lock(m: Mutex) -> void`
- `mutex_unlock(m: Mutex) -> void`

---

## Phase 14 — Networking ✅

### 14.1 — TCP Sockets
Wrapped BSD sockets (Linux/macOS) and Winsock (Windows) in `runtime.c`, exposed as:
```vks
let sock: Socket = tcp_connect("example.com", 80);
socket_send(sock, "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n");
let response: str = socket_recv_all(sock);
socket_close(sock);
```

### 14.2 — Struct-By-Value ABI Hardening
Fully abstracted complex LLVM `%str` and array struct layouts into native `i8*` pointers across the C/LLVM ABI boundary, allowing the compiled executable to interface perfectly with low-level MinGW memory allocators.

---

## Phase 15 — Cross-Platform Native Compilation

### 15.1 — Problem
Phase 8 was verified on Windows via MinGW only. Linux and macOS are unverified.

### 15.2 — Build steps
1. Abstract every OS-specific call in `runtime.c` behind `#ifdef _WIN32 / __APPLE__ / __linux__`
2. Add `--target` flag to the LLVM emitter for explicit target triple selection, defaulting to host OS detection
3. Set up CI (GitHub Actions matrix: `windows-latest`, `ubuntu-latest`, `macos-latest`) running the full test suite + an end-to-end native compile + execute + diff check, identical to what you did manually for Windows

### 15.3 — Deliverable
The same `.vks` file produces correct output on all three major OSes, verified automatically, not manually.

---

## Phase 16 — Self-Hosted Package Manager (Final)

By now we have JSON parsing and file system intrinsics from Phase 11. Complete the port:
- `vks-compiler/pkg.vks` fully replaces `package-manager.ts`
- `vks init` / `vks install` run entirely inside the self-hosted compiler binary
- TypeScript's only remaining job becomes: bootstrapping the *original* compiled binary, nothing more

---

## Phase 17 — Standalone Installer

### 17.1 — The actual independence milestone
Right now, running anything requires `npx tsx src/main.ts ...` — Node.js in the loop. True independence means a user runs `vks` as a plain binary with **nothing else installed.**

### 17.2 — How
Since the compiler is self-hosted and compiles to native code via LLVM, you can compile `vks-compiler/main.vks` itself, ahead of time, into a native `vks` executable. Ship that binary, not the TypeScript source, to end users.

### 17.3 — Installer scripts
Each script downloads the prebuilt `vks` binary + bundled `runtime` object + standard library `.vks` files, places them in a standard location, and adds `vks` to `PATH`.

### 17.4 — Deliverable
A brand-new machine, zero dev tools installed, runs:
```bash
curl -fsSL https://vks-lang.dev/install.sh | sh
vks init my-project
vks install some-package
vks build main.vks -o myapp
./myapp
```

---

## Phase 18 — Editor Tooling

### 18.1 — Syntax highlighting (quick win)
VS Code extension: TextMate grammar + language registration.

### 18.2 — LSP (Language Server Protocol)
Real autocomplete, go-to-definition, inline error squiggles. JSON-RPC over stdio; could be written in Viktor Script itself.

---

## Phase 19 — Battle Test

Build one real, non-toy program entirely in Viktor Script — ideally something using file I/O, a package dependency, networking, and concurrency. 
**Candidate:** a small CLI tool relevant to your other projects — e.g., a log parser, a simple Discord webhook notifier, or a local dev utility.

---

## Phase 20 — Public Launch

- Finalize license (`MIT` recommended for adoption)
- Public GitHub repo (currently private)
- Polish `README.md` / `MANIFESTO.md`
- Optional: a simple static docs site
- Announce

---

## Full Timeline Summary

| Phase | Focus | Status |
|---|---|---|
| 1 | Lexer | ✅ Complete |
| 2 | Parser | ✅ Complete |
| 3 | AST Interpreter | ✅ Complete |
| 4 | Bytecode Compiler | ✅ Complete |
| 5 | Virtual Machine | ✅ Complete |
| 6 | Core Standard Library | ✅ Complete |
| 7 | Self-Hosting Compiler | ✅ Complete |
| 8 | Native LLVM Compilation | ✅ Complete |
| 9 | Package Manager | ✅ Complete |
| 10 | Generics | ✅ Complete |
| 11 | Stdlib Expansion | ✅ Complete |
| 12 | Error Handling & Debugging | ✅ Complete |
| 13 | Concurrency | ✅ Complete |
| 14 | Networking | ✅ Complete |
| 15 | Cross-Platform Native Compile | Next Up (2-3 Weeks) |
| 16 | Self-Hosted Package Manager | Planned (2 Weeks) |
| 17 | Standalone Installer | Planned (2-3 Weeks) |
| 18 | Editor Tooling | Planned (1-4 Weeks) |
| 19 | Battle Test | Planned (2-4 Weeks) |
| 20 | Public Launch | Planned (1 Week) |

**Total Completion:** 14 / 20 Phases (70%)
