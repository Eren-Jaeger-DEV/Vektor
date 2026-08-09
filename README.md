# Vektor

> Systems-level control without the learning cliff.

Vektor (`.vk`) is a general-purpose, statically-typed programming language built entirely from scratch — lexer, parser, interpreter, bytecode VM, standard library, and a native LLVM compiler backend. It is **self-hosted**: the Vektor compiler is written in Vektor itself.

```vks
struct Player {
    name: str;
    score: i32;
}

fn get_rank(score: i32) -> Result<str, str> {
    if score < 0 { return Err("Score cannot be negative"); }
    if score >= 90 { return Ok("S Rank"); }
    if score >= 75 { return Ok("A Rank"); }
    return Ok("B Rank");
}

function main() {
    let p: Player = Player { name: "Vektor", score: 95 };
    let rank = get_rank(p.score);

    if rank.ok {
        print(rank.value);  // S Rank
    } else {
        print(rank.error);
    }
}
```

---

## Why Vektor?

| | Rust | Zig | TypeScript | **Vektor** |
|---|---|---|---|---|
| Memory safety | Borrow checker | Manual | GC | Simple ownership rules |
| Native compilation | ✅ | ✅ | ❌ | ✅ (LLVM) |
| Learning curve | Steep | Steep | Low | **Low** |
| Beginner friendly | ❌ | ❌ | ✅ | ✅ |
| Self-hosted compiler | ✅ | ✅ | ❌ | ✅ |

Rust gives you memory safety through a borrow checker that takes months to internalize. Zig gives you raw control but assumes you're already a systems programmer. TypeScript is easy but can't touch memory or compile to a native binary.

**Vektor's lane:** the power of manual memory and native compilation, without the cliff. One owner per value, explicit `clone()`, no fighting a borrow checker for hours over lifetimes. See [MANIFESTO.md](./docs/MANIFESTO.md) for the full philosophy.

---

## Status — 17 / 20 Phases Complete

| Phase | Description | Status |
|---|---|---|
| 1 | Lexer | ✅ |
| 2 | Parser + AST | ✅ |
| 3 | Tree-walking Interpreter | ✅ |
| 4 | Bytecode Compiler | ✅ |
| 5 | Stack-based Virtual Machine | ✅ |
| 6 | Standard Library (io, math, string, os, net, map, memory) | ✅ |
| 7 | Self-Hosting — compiler written in `.vk` | ✅ |
| 8 | Native compilation via LLVM | ✅ |
| 9 | Package Manager (`vektor.json`, `vk_modules/`) | ✅ |
| 10 | Generics (monomorphization) | ✅ |
| 11 | Standard Library Expansion (fs, json, env, str utils) | ✅ |
| 12 | Error Handling & Stack Traces | ✅ |
| 13 | Concurrency — OS threads, mutexes | ✅ |
| 14 | Networking — TCP sockets, WebSockets | ✅ |
| 15 | Cross-Platform Native Compilation | ✅ |
| 16 | Self-Hosted Package Manager | ✅ |
| 17 | VS Code Extension + LSP foundation | ✅ |
| 18 | Standalone Binary Installer | 🔄 In Progress |
| 19 | Battle Test — real production program | 📋 Planned |
| 20 | Public Launch | 📋 Planned |

Verified with **283 automated tests** (282 passing, 1 skipped) across lexer, parser, interpreter, compiler, VM, standard library, package manager, and example programs — plus end-to-end VM execution of all example files on every CI run.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- [LLVM / Clang](https://releases.llvm.org) — only for native compilation (`--llvm`)

### Install

**One-line (Linux / macOS):**
```bash
curl -fsSL https://raw.githubusercontent.com/Eren-Jaeger-DEV/VKS/main/install.sh | sh
```

**From source:**
```bash
git clone https://github.com/Eren-Jaeger-DEV/VKS.git
cd VKS
npm install
```

### Run a Vektor File

```bash
# Bytecode VM — recommended, fast
npx tsx src/main.ts examples/hello.vk --run

# AST interpreter — immediate, no compilation
npx tsx src/main.ts examples/hello.vk --run-ast

# Compile to .vkb bytecode binary
npx tsx src/main.ts examples/hello.vk --compile

# Execute a pre-compiled .vkb binary
npx tsx src/main.ts examples/hello.vkb --exec

# Compile to LLVM IR → native binary
npx tsx src/main.ts examples/hello.vk --llvm
clang hello.ll runtime.o -o hello
./hello
```

### Run the Test Suite

```bash
npm test
```

---

## Language Highlights

- **Explicit types everywhere** — no inference: `let age: i32 = 20;`
- **Dual syntax** — `function`/`fn`, `&&`/`and`, `||`/`or` — identical, pick your style
- **Nullable types** — `let y: i32? = null;` with compiler-enforced null checks
- **`Result<T, E>` error handling** — no silent failures, no exceptions
- **Simple ownership** — one owner per value, `clone()` to copy, pointers borrow
- **Manual memory** — `alloc`, `free`, `&`, `*` — no garbage collector
- **Generics** — `fn identity<T>(val: T) -> T` via monomorphization (zero runtime cost)
- **Real concurrency** — `spawn`, `mutex_create`, `mutex_lock` via OS threads
- **Networking** — `tcp_connect`, `ws_connect`, `ws_send`, `ws_recv` in stdlib
- **Package manager** — `vektor.json` manifest, `vk_modules/` resolution, bare imports

---

## Project Structure

```
VKS/
├── src/                        # TypeScript toolchain (lexer → parser → compiler → VM → LLVM)
│   ├── lexer.ts
│   ├── parser.ts
│   ├── interpreter.ts
│   ├── compiler.ts
│   ├── vm.ts
│   ├── llvm.ts
│   ├── main.ts                 # CLI entry point
│   └── *.test.ts               # 283 automated tests
│
├── stdlib/                     # Standard library (.vk modules)
│   ├── io.vk
│   ├── math.vk
│   ├── string.vk
│   ├── os.vk
│   ├── net.vk
│   ├── memory.vk
│   └── map.vk
│
├── vektor-compiler/            # Self-hosted compiler written in Vektor
├── vektor-lsp/                 # Language Server Protocol foundation
├── vscode-vektor/              # VS Code syntax highlighting extension
│
├── examples/                   # Example .vk programs
│   ├── hello.vk
│   ├── full.vk
│   ├── interpreter_demo.vk
│   ├── showcase.vk
│   └── discord_bot.vk
│
├── tests/                      # Additional .vk test programs
├── scripts/                    # Build & bootstrap scripts
│   ├── rebootstrap.ts          # Regenerates compiler.vkb from source
│   └── build-native-compiler.ts
│
├── docs/                       # All documentation
│   ├── KNOWLEDGE_BOOK.md       # Complete language reference (beginner → advanced)
│   ├── SPEC.md                 # Formal language specification
│   ├── MANIFESTO.md            # Design philosophy
│   ├── ROADMAP.md              # Full 20-phase roadmap
│   └── PACKAGE_MANAGER.md      # Package manager integration guide
│
├── runtime.c                   # C runtime linked into LLVM native binaries
├── vektor_runtime_ext.c        # Extended runtime (networking, threads, WebSocket)
├── thread_posix.c              # POSIX thread implementation
├── thread_win.c                # Windows thread implementation
├── compiler.vkb                # Pre-compiled self-hosted compiler binary
├── vektor.json                 # This project's own Vektor manifest
├── install.sh                  # Linux/macOS one-line installer
├── install.ps1                 # Windows PowerShell installer
└── LICENSE                     # MIT
```

---

## Documentation

| Document | Description |
|---|---|
| [KNOWLEDGE_BOOK.md](./docs/KNOWLEDGE_BOOK.md) | Complete language guide — beginner to advanced, with AI prompt guide |
| [SPEC.md](./docs/SPEC.md) | Formal language specification |
| [MANIFESTO.md](./docs/MANIFESTO.md) | Design philosophy & guiding principles |
| [ROADMAP.md](./docs/ROADMAP.md) | Full 20-phase development roadmap |
| [PACKAGE_MANAGER.md](./docs/PACKAGE_MANAGER.md) | Package manager integration guide |

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

*Vektor — built from nothing. Foundation for everything.*
