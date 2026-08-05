# The Vektor Manifesto

> *"Systems-level control without the learning cliff."*

## 1. The Core Vision

Programming languages have bifurcated into two extreme camps:

1. **High-level languages (Python, TypeScript, JavaScript):** High developer ergonomics and fast iteration, but bounded by garbage collection overhead, unpredictable latency, heavy runtimes, and an inability to compile to lean native binaries.
2. **Systems languages (C++, Rust, Zig):** Absolute hardware control and raw performance, but guarded by enormous complexity budgets — endless lifetime annotations, borrow-checker battles, manual build tool wrangling, and a steep learning curve.

**Vektor (`.vk`) was created to bridge this gap.**

Our goal is simple: deliver bare-metal performance, manual memory control, and native LLVM code generation, while maintaining syntax clarity and ergonomics that a programmer can learn in an afternoon.

---

## 2. Guiding Principles

### Explicit Over Hidden Magic
Every operation in Vektor is visible. There are no hidden implicit conversions, no mysterious operator overloading side effects, and no background memory sweepers running behind your back. If memory is allocated, you see `alloc`. If it is freed, you see `free`. If a value is copied, you call `clone()`.

### Simple Ownership Over Complex Lifetimes
Rust proved that single ownership produces safe, high-performance software. However, forcing the programmer to solve complex lifetime constraint equations for the compiler is often prohibitive. Vektor enforces **one explicit owner per resource** and simple explicit cloning (`clone()`) or borrowing (`ptr<T>`), avoiding lifetime annotation syntax altogether.

### Zero-Abstraction Penalty
Features in Vektor compile down to simple machine primitives. Structs are contiguous memory layouts. Function calls map directly to standard C ABI stack frames. Generics are monomorphized at compile time into specialized functions — zero runtime dynamic dispatch tax.

### First-Class Self-Hosting & Independence
A systems programming language must own its tools. Vektor is designed to be fully self-hosted: the lexer, parser, monomorphizer, bytecode generator, LLVM emitter, and package manager are written in Vektor. 

---

## 3. The Non-Negotiables

- **No Silent Failures:** Error handling uses `Result<T, E>`. Exceptions and silent `null` dereferences are forbidden.
- **Cross-Platform Parity:** Core primitives, thread management, and networking must compile and execute identically on Linux, macOS, and Windows.
- **Human Readability:** Syntax reads like clear pseudo-code. Beginners and seasoned systems engineers should both understand Vektor instantly.

---

*Vektor is built for developers who want to control their hardware without fighting their compiler.*
