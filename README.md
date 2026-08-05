# Viktor Script

> Systems-level control without the learning cliff.

Viktor Script (`.vks`) is a general-purpose, statically-typed programming language built entirely from scratch — lexer, parser, interpreter, bytecode VM, standard library, and a native LLVM compiler backend. It is **self-hosted**: the Viktor Script compiler is written in Viktor Script itself.

```vks
struct Player {
    name: str;
    score: i32;
}

fn get_rank(score: i32) -> Result<str, str> {
    if score < 0 {
        return Err("Score cannot be negative");
    }
    if score >= 90 { return Ok("S Rank"); }
    return Ok("B Rank");
}

function main() {
    let p: Player = Player { name: "Viktor", score: 95 };
    let rank = get_rank(p.score);

    if rank.ok {
        print(rank.value);
    } else {
        print(rank.error);
    }
}
```

---

## Why Viktor Script?

| | Rust | Zig | TypeScript | **Viktor Script** |
|---|---|---|---|---|
| Memory safety | Borrow checker | Manual | GC | Simple ownership rules |
| Native compilation | ✅ | ✅ | ❌ | ✅ (LLVM) |
| Learning curve | Steep | Steep | Low | **Low** |
| Beginner friendly | ❌ | ❌ | ✅ | ✅ |

Rust gives you memory safety through a borrow checker that takes months to internalize. Zig gives you raw control but assumes you're already a systems programmer. TypeScript is easy to learn but can't touch memory or compile to a native binary.

Viktor Script's lane: **the power of manual memory and native compilation, without the cliff.** One owner per value, explicit `clone()`, no fighting a checker for hours over lifetimes. Every syntax choice in the language points at this same goal — see [Manifesto.md](./Manifesto.md) for the full philosophy.

---

## Status

Viktor Script has completed its full compiler pipeline:

| Phase | Description | Status |
|---|---|---|
| 1 | Lexer | ✅ |
| 2 | Parser + AST | ✅ |
| 3 | Tree-walking Interpreter | ✅ |
| 4 | Bytecode Compiler | ✅ |
| 5 | Stack-based Virtual Machine | ✅ |
| 6 | Standard Library | ✅ |
| 7 | Self-Hosting (compiler written in `.vks`) | ✅ |
| 8 | Native compilation via LLVM | ✅ |

Verified with 280+ automated tests across lexer, parser, interpreter, compiler, VM, and standard library — plus an end-to-end diff proving native LLVM-compiled binaries produce identical output to the VM interpreter.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18+)
- [LLVM / Clang](https://releases.llvm.org) — required only for native compilation (`--llvm` flag)

### Install

#### One-Line Shell Install (Linux / macOS):
```bash
curl -fsSL https://raw.githubusercontent.com/Eren-Jaeger-DEV/VKS/main/install.sh | sh
```

#### From Source:
```bash
git clone https://github.com/Eren-Jaeger-DEV/VKS.git
cd VKS
npm install
```

### Run a Viktor Script file

```bash
# Interpreted (AST walk)
npx tsx src/main.ts examples/hello.vks --run-ast

# Compiled + executed on the bytecode VM
npx tsx src/main.ts examples/hello.vks --run

# Compile to bytecode binary
npx tsx src/main.ts examples/hello.vks --compile -o hello.vkb

# Execute a pre-compiled binary directly
npx tsx src/main.ts hello.vkb --exec

# Compile to LLVM IR, then to a native binary
npx tsx src/main.ts examples/hello.vks --llvm
clang hello.ll runtime.o -o hello.exe
./hello.exe
```

---

## Language Tour

- **Explicit types everywhere** — no inference, no guessing: `let age: i32 = 20;`
- **Dual syntax for beginners and pros** — `function`/`fn`, `&&`/`and`, both valid and identical
- **Nullable types via `?`** — `let y: i32? = null;`, compiler-enforced null checks
- **`Result<T, E>` for errors** — no silent failures, no hidden exceptions
- **Simple ownership model** — one owner per value, `clone()` to copy, pointers borrow
- **Manual memory control** — `alloc`, `free`, `&`, `*` — full control, no garbage collector

Full language specification: [`viktor-script-spec.md`](./viktor-script-spec.md)

---

## Project Structure

```
viktor-script/
├── src/                  # TypeScript implementation (lexer, parser, interpreter, compiler, VM, LLVM emitter)
├── vks-compiler/          # Self-hosted compiler, written in Viktor Script
├── examples/              # Sample .vks programs
├── runtime.c              # C runtime library linked into native LLVM binaries
└── viktor-script-spec.md  # Full language specification
```

---

## Roadmap

With the core pipeline complete, future directions include:

- Full LLVM coverage for `HashMap` and remaining standard library functions
- Generics (currently bypassed via type-specific structs for `Result<T,E>` and arrays)
- Package management (`vkm install`, `viktor.json`)
- Self-hosted serializer producing `.vkb` binaries with zero TypeScript dependency

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

*Viktor Script — built from a spec document to a self-hosted, natively-compiling language.*
