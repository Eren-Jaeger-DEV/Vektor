# Vektor Language Specification
### Version 0.2 — Revised Foundation Draft
**Codename:** Victor  
**File Extension:** `.vk`  
**Author:** Anshuman (Boss)

---

## 1. Philosophy

> "Vektor must read like a human thought and execute like a machine instruction."

Vektor is a foundational, general-purpose programming language built from scratch. It is designed to serve as the base for everything — from operating systems to simple scripts. No dependency. No abstraction borrowed from another language. Everything is built on Vektor itself.

**Core principles:**
- Every line of code must be readable by a human
- Every line of code must be unambiguous to the compiler
- No hidden magic — every symbol has one obvious meaning
- Control first — the programmer is fully in charge
- Power comes with responsibility — Vektor trusts you, not the runtime

---

## 2. File Extension

All Vektor source files use the `.vk` extension.

```
main.vk
math.vk
os_kernel.vk
```

---

## 3. Comments

Only single-line comments are supported. There are no multi-line comment blocks.

```vks
// This is a comment
// Each line needs its own comment marker
let x: i32 = 10; // inline comment
```

---

## 4. Primitive Types

These are the atoms of Vektor. Everything else is built from these.

| Type | Description | Size |
|------|-------------|------|
| `i8` | 8-bit signed integer | 1 byte |
| `i16` | 16-bit signed integer | 2 bytes |
| `i32` | 32-bit signed integer | 4 bytes |
| `i64` | 64-bit signed integer | 8 bytes |
| `f32` | 32-bit floating point | 4 bytes |
| `f64` | 64-bit floating point | 8 bytes |
| `bool` | true or false | 1 byte |
| `byte` | raw memory unit | 1 byte |
| `ptr<T>` | memory address pointing to type T | 8 bytes (64-bit) |

**Strings do not exist as a primitive.** The `str` type is a built-in struct — a wrapper around a `byte[]` with a known length. This is the honest, foundational truth.

### String Rules:
- Encoding is **UTF-8** — always, no exceptions
- Strings are **length-prefixed** — the length is stored alongside the bytes, not a null terminator like C
- Strings are **immutable by default** — you cannot modify a string after creation
- To get raw bytes, access `.bytes` and `.len` fields

```vks
let name: str = "Vektor";       // UTF-8, immutable, length-prefixed
let length: i32 = name.len;     // 6
let raw: byte[] = name.bytes;   // underlying byte array

// Strings are immutable — this is a compiler error:
name[0] = 'A';  // ❌ cannot mutate an immutable str

// To work with raw bytes directly (advanced/OS-level):
let buf: byte[] = [86, 105, 107, 116, 111, 114]; // "Vektor" as bytes
```

---

## 5. Variables

Variables are declared with `let`. Types are always explicit — no inference.

```vks
let age: i32 = 20;
let pi: f64 = 3.14159;
let alive: bool = true;
let initial: byte = 'V';
```

### 5.1 Constants

A constant is a value that can never be reassigned. Declared with `const`.

```vks
const MAX_PLAYERS: i32 = 100;
const PI: f64 = 3.14159265358979;
const APP_NAME: byte[] = "VektorOS";

// This is a compiler error:
MAX_PLAYERS = 200; // ❌ cannot reassign a constant
```

### 5.2 Nullable Types

By default, no variable can hold `null`. To allow null, append `?` to the type. The compiler forces a null check before use.

```vks
let x: i32 = 10;       // can NEVER be null
let y: i32? = null;    // explicitly nullable

// Compiler enforces null check:
if y != null {
    print(y);          // safe to use
}
```

---

## 6. Functions

Functions are declared with `function` or `fn` — both are identical. `fn` is the shorthand alias for developers who prefer speed.

```vks
// Full form
function add(a: i32, b: i32) -> i32 {
    return a + b;
}

// Alias form — identical behavior
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}
```

Functions with no return value use `-> void` or omit the return type.

```vks
fn greet(name: byte[]) -> void {
    print(name);
}
```

---

## 7. Entry Point

Every Vektor program begins execution at the `main` function.

```vks
function main() {
    print("Hello from Vektor");
}
```

This is mandatory for compiled programs. Interpreted scripts may also use `main()` as the entry point.

---

## 8. Control Flow

### 8.1 If / Else

```vks
let score: i32 = 85;

if score >= 90 {
    print("A grade");
} else if score >= 75 {
    print("B grade");
} else {
    print("Try harder");
}
```

### 8.2 While Loop

```vks
let i: i32 = 0;

while i < 10 {
    print(i);
    i = i + 1;
}
```

### 8.3 For Loop

Both styles are valid and identical in behavior.

```vks
// C-style for loop
for (let i: i32 = 0; i < 10; i++) {
    print(i);
}

// Range-style for loop
for i in 0..10 {
    print(i);
}
```

---

## 9. Boolean Operators

Both symbolic and word-form operators are valid. They are identical.

| Symbol | Word | Meaning |
|--------|------|---------|
| `&&` | `and` | logical AND |
| `\|\|` | `or` | logical OR |
| `!` | `not` | logical NOT |

```vks
if x > 5 && y < 10 {}       // symbol style
if x > 5 and y < 10 {}      // word style — identical

if !alive {}                 // symbol
if not alive {}              // word — identical
```

---

## 10. Arrays

Both fixed-size and dynamic arrays are supported.

```vks
// Fixed-size array — stack allocated, size cannot change
let scores: i32[5] = [10, 20, 30, 40, 50];

// Dynamic array — heap allocated, size can grow
let names: byte[][] = ["Vektor", "Atlas", "Callisto"];

// Accessing elements
let first: i32 = scores[0];
```

---

## 11. Structs

Vektor uses structs instead of classes at the foundation level. No inheritance. No methods inside structs (at this stage). Just data grouped together.

```vks
struct Point {
    x: f32;
    y: f32;
}

struct Person {
    name: byte[];
    age:  i32;
}

// Creating a struct instance
let p: Person = Person { name: "Vektor", age: 20 };

// Accessing fields
print(p.name);
print(p.age);
```

---

## 12. Pointers & Memory

Vektor gives the programmer direct control over memory. This is required for OS-level programming.

### 12.1 Pointer Syntax

```vks
let x: i32 = 10;

let p: ptr<i32> = &x;   // & = "address of x"
let val: i32 = *p;      // * = "value at address p"
```

### 12.2 Manual Memory Management

```vks
// Allocate memory on the heap
let buffer: ptr<byte> = alloc(1024); // 1024 bytes

// Use the memory
buffer[0] = 'V';
buffer[1] = 'K';
buffer[2] = 'S';

// Free the memory when done
free(buffer);
```

The programmer is fully responsible for freeing allocated memory. There is no garbage collector.

### 12.3 Ownership Model

Every value in Vektor has exactly **one owner** at a time. This prevents double-free bugs and makes memory behaviour predictable.

**Rule 1 — One owner:**
```vks
let a: i32 = 10;   // a owns the value 10
let b: i32 = a;    // ownership moves to b — a is now invalid
print(a);          // ❌ compiler error — a no longer owns anything
```

**Rule 2 — To keep both, use `clone()`:**
```vks
let a: str = "Vektor";
let b: str = clone(a);  // b gets a full copy — a still valid
print(a);               // ✅ fine
print(b);               // ✅ fine
```

**Rule 3 — Pointers borrow, they do not own:**
```vks
let x: i32 = 10;
let p: ptr<i32> = &x;  // p borrows x — x still owns the value
// x is still alive, p just points to it
// freeing p here would be wrong — x owns the memory
```

**Rule 4 — When the owner leaves scope, memory is freed:**
```vks
function main() {
    let buffer: ptr<byte> = alloc(256);  // buffer owns heap memory
    buffer[0] = 'V';
    // end of scope — buffer is freed automatically
}
// no need to call free() — ownership rules handle it
// BUT: if you pass buffer to another owner, you must free it there
```

This ownership model does not replace `alloc`/`free` at the OS level — those still exist for raw hardware access. But for normal Vektor programs, following ownership rules eliminates most memory bugs.

---

## 13. Type Casting

Convert between types explicitly using `cast<T>()`.

```vks
let x: i32 = 42;
let y: f64 = cast<f64>(x);   // i32 → f64

let a: f32 = 3.14;
let b: i32 = cast<i32>(a);   // f32 → i32, truncates decimal
```

Implicit casting does not exist in Vektor. All conversions must be explicit.

---

## 14. Error Handling

Functions that can fail return a `Result<T, E>` type. Callers are forced to handle both success and failure. Silent failures do not exist in Vektor.

```vks
fn divide(a: i32, b: i32) -> Result<i32, byte[]> {
    if b == 0 {
        return Err("Cannot divide by zero");
    }
    return Ok(a / b);
}

// Caller must handle both cases
let result = divide(10, 2);

if result.ok {
    print(result.value);
} else {
    print(result.error);
}
```

---

## 15. Imports

Split code across multiple `.vk` files using `import`.

```vks
import "math.vk";
import "memory.vk";
import "io.vk";

function main() {
    let result = add(5, 10); // from math.vk
}
```

The compiler resolves imports relative to the current file's directory.

---

## 16. Compiled vs Interpreted Mode

Vektor supports both modes from a single source file.

```bash
# Interpreted mode — runs immediately
vks run main.vk

# Compiled mode — produces bytecode
vks compile main.vk -o main.vkb

# Run compiled bytecode
vks exec main.vkb

# Native binary (future — via LLVM target)
vks build main.vk -o main
```

---

## 17. Complete Example Program

```vks
import "io.vk";

// A struct representing a player
struct Player {
    name: byte[];
    score: i32;
    alive: bool;
}

// A function that can fail
fn get_rank(score: i32) -> Result<byte[], byte[]> {
    if score < 0 {
        return Err("Score cannot be negative");
    }
    if score >= 90 {
        return Ok("S Rank");
    } else if score >= 75 {
        return Ok("A Rank");
    } else {
        return Ok("B Rank");
    }
}

function main() {
    let p: Player = Player { name: "Vektor", score: 95, alive: true };

    print(p.name);

    let rank = get_rank(p.score);

    if rank.ok {
        print(rank.value);
    } else {
        print(rank.error);
    }

    // Memory example
    let buffer: ptr<byte> = alloc(256);
    buffer[0] = 'V';
    free(buffer);
}
```

---

## 18. Reserved Keywords

```
let      const    function  fn       return
if       else     while     for      in
struct   true     false     null     and
or       not      import    alloc    free
cast     Result   Ok        Err      ptr
void     bool     byte      str      i8
i16      i32      i64       f32      f64
clone    move
```

---

*Vektor — Built from nothing. Foundation for everything.*
