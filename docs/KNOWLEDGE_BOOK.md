# 📖 The Complete Vektor (.vk) Language Book
### From Zero to Self-Hosted — A Full Developer Reference

> *"Vektor must read like a human thought and execute like a machine instruction."*
> — Vektor Language Specification, Version 0.2

**Language:** Vektor (`.vk`)  
**Codename:** Victor  
**Version:** 0.2 — Revised Foundation Draft  
**Author of Language:** Anshuman (Boss)  
**Purpose of This Book:** A complete guide for human developers and AI coding assistants who want to write real Vektor code from day one.

---

## 📋 Table of Contents

1. [What is Vektor?](#1-what-is-vektor)
2. [Installation & Toolchain](#2-installation--toolchain)
3. [Your First Program](#3-your-first-program)
4. [Comments](#4-comments)
5. [Primitive Types](#5-primitive-types)
6. [Variables & Constants](#6-variables--constants)
7. [Strings](#7-strings)
8. [Operators & Arithmetic](#8-operators--arithmetic)
9. [Boolean Logic](#9-boolean-logic)
10. [Control Flow — if / else](#10-control-flow--if--else)
11. [Loops — while, for, for-in](#11-loops--while-for-for-in)
12. [Functions](#12-functions)
13. [Arrays](#13-arrays)
14. [Structs](#14-structs)
15. [Nullable Types](#15-nullable-types)
16. [Type Casting](#16-type-casting)
17. [Error Handling — Result<T, E>](#17-error-handling--resultt-e)
18. [Pointers & Memory](#18-pointers--memory)
19. [Ownership & Clone](#19-ownership--clone)
20. [Imports & Modules](#20-imports--modules)
21. [Standard Library Reference](#21-standard-library-reference)
22. [Generics](#22-generics)
23. [Concurrency — Threads & Mutexes](#23-concurrency--threads--mutexes)
24. [Networking — TCP & WebSockets](#24-networking--tcp--websockets)
25. [Package Manager (vk_modules)](#25-package-manager-vk_modules)
26. [Execution Modes](#26-execution-modes)
27. [Complete Example Programs](#27-complete-example-programs)
28. [Reserved Keywords](#28-reserved-keywords)
29. [AI Coding Assistant Prompt Guide](#29-ai-coding-assistant-prompt-guide)
30. [Common Mistakes & Gotchas](#30-common-mistakes--gotchas)

---

## 1. What is Vektor?

Vektor is a **statically-typed, compiled, general-purpose programming language** built from scratch. It is designed to be the foundation for everything — from operating systems to Discord bots to web servers — with no external dependencies borrowed from other languages.

### Core Philosophy
- Every line **reads like a human thought** and **executes like a machine instruction**
- **No hidden magic** — every symbol has exactly one obvious meaning
- **No implicit type coercion** — all casts are explicit
- **Programmer is in full control** — memory, threads, networking
- **No garbage collector** — manual memory management with ownership rules
- **Strings do not exist as a primitive** — `str` is a built-in struct wrapping a `byte[]`

### Vektor Is Not
- Not Python (no dynamic typing, no implicit runtime)
- Not JavaScript (no garbage collector, no `undefined`, no `typeof`)
- Not C++ (no inheritance, no templates, no virtual dispatch — generics use monomorphization)
- Not Rust (simpler ownership model, no borrow checker lifetime annotations)

### What Vektor Is
A language where **the compiler trusts you**. It gives you power and expects you to use it responsibly.

---

## 2. Installation & Toolchain

### Prerequisites
- [Node.js](https://nodejs.org) v18+ (for the current TypeScript-hosted toolchain)
- `npx` (bundled with Node.js)

### Install from Source (Current — Development Stage)
```bash
git clone https://github.com/Eren-Jaeger-DEV/Vektor.git
cd Vektor
npm install
```

### Running a Vektor File
```bash
# Bytecode VM mode (recommended — fast, compiled bytecode)
npx tsx src/main.ts my_program.vk --run

# AST Interpreter mode (slow, immediate, no compilation step)
npx tsx src/main.ts my_program.vk --run-ast

# Compile to .vkb bytecode file (does not run, saves binary)
npx tsx src/main.ts my_program.vk --compile
```

### Running Compiled Bytecode
```bash
# Compile first
npx tsx src/main.ts my_program.vk --compile
# Then run the .vkb file
npx tsx src/main.ts my_program.vkb --exec
```

### Future: Standalone Binary
When the standalone installer is shipped:
```bash
curl -fsSL https://vks-lang.dev/install.sh | sh
vks run main.vk
vks build main.vk -o myapp
./myapp
```

---

## 3. Your First Program

Every Vektor program starts with a `main` function. This is the entry point.

```vks
function main() {
    print("Hello from Vektor");
}
```

Save as `hello.vk` and run:
```bash
npx tsx src/main.ts hello.vk --run
```

Expected output:
```
Hello from Vektor
Program finished successfully
```

> **Note:** `print` is a native built-in. You do NOT need to import anything to use it in a standalone file. If your file imports other modules, add `import "io.vk";` at the top to declare the dependency explicitly.

---

## 4. Comments

Vektor supports **single-line comments only**. There are no multi-line block comments.

```vks
// This is a comment
let x: i32 = 10; // Inline comment

// To comment out multiple lines, prefix each one:
// let y: i32 = 20;
// let z: i32 = 30;
```

> ❌ Block comments like `/* ... */` do **not** exist in Vektor.

---

## 5. Primitive Types

Every value has exactly one type, declared explicitly.

| Type | Description | Size | Example |
|------|-------------|------|---------|
| `i8` | 8-bit signed integer | 1 byte | `-128` to `127` |
| `i16` | 16-bit signed integer | 2 bytes | `-32768` to `32767` |
| `i32` | 32-bit signed integer | 4 bytes | `-2147483648` to `2147483647` |
| `i64` | 64-bit signed integer | 8 bytes | Very large numbers |
| `f32` | 32-bit floating point | 4 bytes | `3.14` |
| `f64` | 64-bit floating point | 8 bytes | `3.141592653589793` |
| `bool` | Boolean | 1 byte | `true` or `false` |
| `byte` | Raw memory unit / single character | 1 byte | `'V'` |
| `ptr<T>` | Memory address pointing to type T | 8 bytes (64-bit) | `&some_var` |

### Which type should I use?
- **`i32`** — most whole-number work (counters, indices, scores)
- **`i64`** — very large numbers (timestamps, file sizes)
- **`f64`** — most decimal math
- **`f32`** — memory-critical code where precision can be sacrificed
- **`byte`** — raw memory, buffers, single ASCII characters

---

## 6. Variables & Constants

### Variables — `let`
Types are always explicit. No inference.

```vks
let age: i32 = 20;
let pi: f64 = 3.14159;
let alive: bool = true;
let initial: byte = 'V';
```

Variables can be reassigned:
```vks
let score: i32 = 0;
score = 100;  // OK
```

### Constants — `const`
Cannot ever be reassigned.

```vks
const MAX_PLAYERS: i32 = 100;
const PI: f64 = 3.14159265358979;
const APP_NAME: str = "VektorOS";

MAX_PLAYERS = 200; // Compiler error
```

### Naming Convention
- Variables/functions: `snake_case` — `player_score`, `get_rank`
- Constants: `UPPER_SNAKE_CASE` — `MAX_PLAYERS`, `DEFAULT_PORT`
- Structs: `PascalCase` — `Player`, `DiscordMessage`

---

## 7. Strings

`str` is **not a primitive**. It is a built-in struct wrapping a `byte[]` with a length.

### The Rules of Strings
1. Encoding is **UTF-8** — always
2. Strings are **length-prefixed** — length stored alongside bytes
3. Strings are **immutable by default**
4. Raw access via `.len` and `.bytes`

```vks
let name: str = "Vektor";
let length: i32 = name.len;    // 6
let raw: byte[] = name.bytes;  // underlying byte array
```

### Concatenation
```vks
let greeting: str = "Hello, " + "Vektor!";
print(greeting); // Hello, Vektor!
```

### Number to String
```vks
let score: i32 = 95;
let msg: str = "Score: " + toString(score);
print(msg); // Score: 95
```

### Strings Are Immutable
```vks
let s: str = "Vektor";
s[0] = 'A'; // Compiler error

// Use byte[] for mutable buffers instead:
let buf: byte[] = [86, 101, 107, 116, 111, 114];
buf[0] = 65; // OK — change 'V' to 'A'
```

---

## 8. Operators & Arithmetic

```vks
let a: i32 = 10;
let b: i32 = 3;

print(a + b);  // 13 — addition
print(a - b);  // 7  — subtraction
print(a * b);  // 30 — multiplication
print(a / b);  // 3  — integer division (truncates)
print(a % b);  // 1  — modulo
```

### Operator Precedence
Standard math rules apply:
```vks
print(10 + 5 * 2);    // 20 (multiply first)
print((10 + 5) * 2);  // 30 (parentheses first)
```

### Comparison Operators
```vks
x == y  // equal to
x != y  // not equal to
x < y   // less than
x > y   // greater than
x <= y  // less than or equal
x >= y  // greater than or equal
```

### Increment (For Loops Only)
```vks
for (let i: i32 = 0; i < 10; i++) {
    print(i);
}
// Use i = i + 1 everywhere else
```

---

## 9. Boolean Logic

Two styles — both identical:

| Symbolic | Word | Meaning |
|----------|------|---------|
| `&&` | `and` | Logical AND |
| `\|\|` | `or` | Logical OR |
| `!` | `not` | Logical NOT |

```vks
let age: i32 = 25;
let alive: bool = true;

if age >= 18 && alive {
    print("Adult and alive");
}
if age >= 18 and alive {  // identical
    print("Adult and alive");
}

if !alive {}
if not alive {}  // identical

if age < 10 || !alive {}
if age < 10 or not alive {}  // identical
```

---

## 10. Control Flow — if / else

```vks
let score: i32 = 85;

if score >= 90 {
    print("A grade");
} else if score >= 75 {
    print("B grade");
} else if score >= 60 {
    print("C grade");
} else {
    print("Try harder");
}
```

Parentheses around conditions are optional:
```vks
if (score > 50) {  // also valid
    print("Pass");
}
```

> ❌ There is **no ternary operator**. Use `if / else` blocks.

---

## 11. Loops — while, for, for-in

### While Loop
```vks
let i: i32 = 0;
while i < 5 {
    print(i);
    i = i + 1;
}
// Output: 0 1 2 3 4
```

### C-Style For Loop
```vks
for (let j: i32 = 0; j < 5; j++) {
    print(j);
}
// Output: 0 1 2 3 4
```

### Range-Style For-In Loop
`start` is **inclusive**, `end` is **exclusive**.
```vks
for k in 0..5 {
    print(k);
}
// Output: 0 1 2 3 4

for i in 1..6 {
    print(i);
}
// Output: 1 2 3 4 5
```

### Accumulating with a Loop
```vks
let sum: i32 = 0;
for i in 1..6 {
    sum = sum + i;
}
print(sum); // 15
```

---

## 12. Functions

Declared with `function` or `fn` — identical.

```vks
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

function add(a: i32, b: i32) -> i32 {  // same thing
    return a + b;
}

let result: i32 = add(10, 20);
print(result); // 30
```

### Void Functions
```vks
fn greet(name: str) -> void {
    print("Hello, " + name + "!");
}

fn greet(name: str) {  // -> void can be omitted
    print("Hello, " + name + "!");
}
```

### Recursive Functions
```vks
fn factorial(n: i32) -> i32 {
    if n <= 1 {
        return 1;
    }
    return n * factorial(n - 1);
}

print(factorial(5));  // 120
print(factorial(10)); // 3628800
```

---

## 13. Arrays

### Fixed-Size (Stack Allocated)
```vks
let scores: i32[5] = [10, 20, 30, 40, 50];
let first: i32 = scores[0]; // 10  (zero-indexed)
let last: i32 = scores[4];  // 50

scores[2] = 999;             // mutation OK
print(scores[2]);            // 999
```

### Dynamic Array
```vks
let names: str[] = ["Alice", "Bob", "Charlie"];
```

### Iterating
```vks
let nums: i32[3] = [100, 200, 300];
for (let i: i32 = 0; i < 3; i++) {
    print(nums[i]);
}
```

### Byte Arrays (Raw Buffers)
```vks
let buf: byte[] = [86, 101, 107, 116, 111, 114]; // "Vektor" in bytes
```

---

## 14. Structs

Structs group related data. No classes, no inheritance, no methods inside structs.

```vks
struct Player {
    name: str;
    score: i32;
    alive: bool;
}

let p: Player = Player { name: "Vektor", score: 95, alive: true };

print(p.name);   // Vektor
print(p.score);  // 95
p.score = 100;   // mutation OK
```

### Nested Structs
```vks
struct Point {
    x: f32;
    y: f32;
}

struct Circle {
    center: Point;
    radius: f32;
}

let c: Circle = Circle {
    center: Point { x: 0.0, y: 0.0 },
    radius: 5.0
};

print(c.center.x); // 0.0
```

### Passing Structs to Functions
```vks
fn print_player(p: Player) -> void {
    print("Name: " + p.name);
    print("Score: " + toString(p.score));
}
```

### Structs in Result
```vks
struct Task {
    id: i32;
    title: str;
    priority: i32;
    completed: bool;
}

fn create_task(id: i32, title: str, priority: i32) -> Result<Task, str> {
    if priority < 1 || priority > 5 {
        return Err("Priority must be between 1 and 5");
    }
    return Ok(Task {
        id: id,
        title: title,
        priority: priority,
        completed: false
    });
}
```

---

## 15. Nullable Types

By default, **no variable can hold `null`**. Append `?` to opt in.

```vks
let x: i32 = 10;    // NEVER null
let y: i32? = null; // explicitly nullable
```

### Null Check Required Before Use
```vks
let y: i32? = null;

if y != null {
    print(y);           // safe here
} else {
    print("y is null");
}
```

### Assigning to a Nullable
```vks
let score: i32? = null;
score = 95;  // valid
```

---

## 16. Type Casting

**No implicit coercion**. Use `cast<T>()` for all conversions.

```vks
let x: i32 = 42;
let y: f64 = cast<f64>(x);    // i32 -> f64, becomes 42.0

let a: f32 = 3.14;
let b: i32 = cast<i32>(a);    // f32 -> i32, becomes 3 (truncated)

let c: byte = 'A';
let n: i32 = cast<i32>(c);    // byte -> i32, becomes 65 (ASCII)
```

> ❌ You cannot cast `str` to `i32` directly. Use `parseI32()` from `string.vk`.

---

## 17. Error Handling — Result<T, E>

No exceptions. Functions that can fail return `Result<T, E>`.

```vks
fn divide(a: i32, b: i32) -> Result<i32, str> {
    if b == 0 {
        return Err("Cannot divide by zero");
    }
    return Ok(a / b);
}

let result = divide(10, 2);
if result.ok {
    print(result.value);  // 5
} else {
    print(result.error);
}

let bad = divide(10, 0);
if bad.ok {
    print(bad.value);
} else {
    print(bad.error); // "Cannot divide by zero"
}
```

### Result Fields

| Field | Type | Meaning |
|-------|------|---------|
| `result.ok` | `bool` | `true` if operation succeeded |
| `result.value` | `T` | The success value |
| `result.error` | `E` | The error value |

### Grading Example
```vks
fn get_rank(score: i32) -> Result<str, str> {
    if score < 0 { return Err("Score cannot be negative"); }
    if score >= 90 { return Ok("S Rank"); }
    if score >= 75 { return Ok("A Rank"); }
    return Ok("B Rank");
}

let rank = get_rank(95);
if rank.ok {
    print(rank.value); // S Rank
}
```

---

## 18. Pointers & Memory

### Pointer Basics
`&` = address of. `*` = dereference (value at address).

```vks
let x: i32 = 42;
let p: ptr<i32> = &x;   // p points to x
let val: i32 = *p;       // val = 42
print(val);
```

### Manual Heap Memory
```vks
let buffer: ptr<byte> = alloc(256); // 256 bytes on heap

buffer[0] = 'V';
buffer[1] = 'K';
buffer[2] = 'S';

print(buffer[0]); // V
print(buffer[1]); // K

free(buffer); // ALWAYS free what you allocate
```

### Memory Helpers (stdlib/memory.vk)
```vks
import "memory.vk";

let buf:  ptr<byte> = alloc_bytes(1024);  // 1024 bytes
let num:  ptr<i32>  = alloc_i32();        // 4 bytes
let zero: ptr<byte> = alloc_zeroed(512);  // 512 bytes all set to 0

free(buf);
free(num);
free(zero);
```

### Passing a Pointer to a Function
```vks
fn increment(p: ptr<i32>) -> void {
    *p = *p + 1;
}

let count: i32 = 0;
increment(&count);
print(count); // 1
```

---

## 19. Ownership & Clone

Every value has exactly **one owner** at a time.

### Rule 1 — Ownership Moves
```vks
let a: str = "Vektor";
let b: str = a;     // a is now invalid
print(a);           // Compiler error
```

### Rule 2 — clone() for Independent Copy
```vks
let a: str = "Vektor";
let b: str = clone(a); // b gets a full copy
print(a);              // fine
print(b);              // fine
```

### Rule 3 — Pointers Borrow, Not Own
```vks
let x: i32 = 10;
let p: ptr<i32> = &x; // p borrows x — x is still the owner
```

### Rule 4 — Always Free Heap Memory
```vks
function main() {
    let buffer: ptr<byte> = alloc(256);
    buffer[0] = 'V';
    free(buffer); // Required — no garbage collector
}
```

---

## 20. Imports & Modules

```vks
import "io.vk";
import "math.vk";
import "string.vk";
```

Resolved **relative to the current file's directory**.

### Package Imports
```vks
import "utils";     // resolves to vk_modules/utils/main.vk
import "math-lib";  // resolves to vk_modules/math-lib/main.vk
```

### Imports Must Come First
```vks
// Correct
import "math.vk";
fn add(a: i32, b: i32) -> i32 { ... }

// Wrong — compiler rejects this
fn add(a: i32, b: i32) -> i32 { ... }
import "math.vk";
```

---

## 21. Standard Library Reference

### io.vk — Input/Output
```vks
import "io.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `print` | `print(value: any)` | Print to stdout (no import needed) |
| `toString` | `toString(value: any) -> str` | Convert any value to string |
| `readLine` | `readLine() -> str` | Read line from stdin |
| `read_file` | `read_file(path: str) -> str` | Read entire file |
| `write_file` | `write_file(path: str, content: str) -> void` | Write to file |
| `parseFloat` | `parseFloat(s: str) -> f64` | Parse string as float |

```vks
import "io.vk";

print("Hello");              // Hello
print(42);                   // 42
let s: str = toString(100);  // "100"
let msg: str = "Score: " + toString(95);
print(msg);                  // Score: 95
```

---

### math.vk — Math Utilities
```vks
import "math.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `min` | `min(a: i32, b: i32) -> i32` | Smaller of two values |
| `max` | `max(a: i32, b: i32) -> i32` | Larger of two values |
| `clamp` | `clamp(val: i32, lo: i32, hi: i32) -> i32` | Clamp to range |
| `add` | `add(a: i32, b: i32) -> i32` | Addition |
| `sub` | `sub(a: i32, b: i32) -> i32` | Subtraction |
| `mul` | `mul(a: i32, b: i32) -> i32` | Multiplication |
| `div` | `div(a: i32, b: i32) -> i32` | Division |
| `sqrt` | `sqrt(x: f64) -> f64` | Square root (native) |
| `pow` | `pow(base: f64, exp: f64) -> f64` | Power (native) |
| `sin` | `sin(x: f64) -> f64` | Sine (native) |
| `cos` | `cos(x: f64) -> f64` | Cosine (native) |
| `abs` | `abs(x: f64) -> f64` | Absolute value (native) |
| `floor` | `floor(x: f64) -> f64` | Round down (native) |
| `ceil` | `ceil(x: f64) -> f64` | Round up (native) |

```vks
import "math.vk";

print(min(3, 7));         // 3
print(max(3, 7));         // 7
print(clamp(15, 0, 10));  // 10

let score: f64 = pow(4.0, 2.0) + cast<f64>(5) * 1.5;
print(score);             // 23.5
```

---

### string.vk — String Utilities
```vks
import "string.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `len` | `len(s: str) -> i32` | Character count |
| `isEmpty` | `isEmpty(s: str) -> bool` | True if length is 0 |
| `startsWith` | `startsWith(s: str, prefix: str) -> bool` | True if s starts with prefix |
| `indexOf` | `indexOf(s: str, sub: str) -> i32` | First occurrence index, -1 if missing |
| `substring` | `substring(s: str, start: i32, end: i32) -> str` | Extract slice |
| `charAt` | `charAt(s: str, i: i32) -> byte` | Character at index |
| `toUpper` | `toUpper(s: str) -> str` | Uppercase |
| `toLower` | `toLower(s: str) -> str` | Lowercase |
| `trim` | `trim(s: str) -> str` | Strip whitespace |
| `parseI32` | `parseI32(s: str) -> i32` | Parse string to integer |

```vks
import "string.vk";

let s: str = "Hello, Vektor!";

print(len(s));                  // 14
print(isEmpty(s));              // false
print(startsWith(s, "Hello"));  // true
print(indexOf(s, "Vektor"));    // 7
print(substring(s, 0, 5));      // Hello
```

---

### os.vk — OS Utilities
```vks
import "os.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `system` | `system(cmd: str) -> i32` | Run shell command, returns exit code |
| `time` | `time() -> i64` | Current Unix timestamp |
| `exit` | `exit(code: i32) -> void` | Exit with status code |
| `get_env` | `get_env(name: str) -> str` | Read environment variable |
| `get_args` | `get_args() -> str[]` | Get CLI arguments |

```vks
import "os.vk";

let code: i32 = system("echo Hello from shell");
let now: i64 = time();
print("Timestamp: " + toString(now));
exit(0);
```

---

### memory.vk — Memory Helpers
```vks
import "memory.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `alloc_bytes` | `alloc_bytes(size: i32) -> ptr<byte>` | Allocate N bytes |
| `alloc_i32` | `alloc_i32() -> ptr<i32>` | Allocate one i32 (4 bytes) |
| `alloc_zeroed` | `alloc_zeroed(size: i32) -> ptr<byte>` | Allocate N bytes, zeroed |

---

### net.vk — Networking
```vks
import "net.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `ws_connect` | `ws_connect(url: str) -> i32` | Open WebSocket, returns handle |
| `ws_send` | `ws_send(sock: i32, msg: str) -> void` | Send message |
| `ws_recv` | `ws_recv(sock: i32) -> str` | Receive message (blocking) |
| `ws_close` | `ws_close(sock: i32) -> void` | Close connection |
| `tcp_connect` | `tcp_connect(host: str, port: i32) -> Socket` | Open TCP connection |
| `socket_send` | `socket_send(sock: Socket, data: str) -> void` | Send raw TCP data |
| `socket_recv_all` | `socket_recv_all(sock: Socket) -> str` | Receive all data |
| `socket_close` | `socket_close(sock: Socket) -> void` | Close TCP socket |

```vks
import "net.vk";

let sock: Socket = tcp_connect("example.com", 80);
socket_send(sock, "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n");
let response: str = socket_recv_all(sock);
print(response);
socket_close(sock);
```

---

### map.vk — Key-Value Maps
```vks
import "map.vk";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `map_create` | `map_create() -> Map` | Create empty map |
| `map_set` | `map_set(m: Map, key: str, val: str) -> void` | Set key |
| `map_get` | `map_get(m: Map, key: str) -> str` | Get value |
| `map_has` | `map_has(m: Map, key: str) -> bool` | Check key exists |
| `map_delete` | `map_delete(m: Map, key: str) -> void` | Remove key |

---

## 22. Generics

`<T>` syntax. Compiler uses **monomorphization** — generates concrete code per type. Zero runtime overhead.

### Generic Functions
```vks
fn identity<T>(val: T) -> T {
    return val;
}

let x: i32 = identity<i32>(42);
let s: str  = identity<str>("hello");
```

### Generic Structs
```vks
struct Box<T> {
    value: T;
}

let int_box: Box<i32> = Box { value: 100 };
let str_box: Box<str> = Box { value: "Vektor" };

print(int_box.value); // 100
print(str_box.value); // Vektor
```

### Result<T, E> Is a Generic
`Result<T, E>` is the built-in generic error handling type — `T` for success, `E` for error.

---

## 23. Concurrency — Threads & Mutexes

Real OS-level threads via `pthread` (Linux/macOS) and `CreateThread` (Windows). No interpreter lock.

### Spawn a Thread
```vks
fn worker_fn() -> void {
    print("Running in background thread");
}

let t: Thread = spawn worker_fn();
t.join(); // wait for completion
print("Thread finished");
```

### Mutex — Protecting Shared State
```vks
let counter: i32 = 0;
let m: Mutex = mutex_create();

fn increment() -> void {
    mutex_lock(m);
    counter = counter + 1;
    mutex_unlock(m);
}

let t1: Thread = spawn increment();
let t2: Thread = spawn increment();
t1.join();
t2.join();

print(counter); // 2
```

### Thread Primitives

| Primitive | Signature | Description |
|-----------|-----------|-------------|
| `spawn` | `spawn fn_name(args) -> Thread` | Launch OS thread |
| `t.join` | `t.join() -> void` | Wait for thread to finish |
| `mutex_create` | `mutex_create() -> Mutex` | Create mutex |
| `mutex_lock` | `mutex_lock(m: Mutex) -> void` | Acquire lock |
| `mutex_unlock` | `mutex_unlock(m: Mutex) -> void` | Release lock |

---

## 24. Networking — TCP & WebSockets

### Discord Gateway WebSocket Bot
```vks
import "net.vk";
import "io.vk";

function main() {
    let sock: i32 = ws_connect("wss://gateway.discord.gg/?v=10&encoding=json");
    let hello: str = ws_recv(sock);
    print("Received: " + hello);

    let identify: str = "{\"op\":2,\"d\":{\"token\":\"YOUR_TOKEN\",\"intents\":513}}";
    ws_send(sock, identify);

    while true {
        let event: str = ws_recv(sock);
        print("Event: " + event);
    }
}
```

### Discord Webhook
```vks
import "io.vk";
import "os.vk";

struct DiscordMessage {
    username: str;
    content:  str;
}

fn format_payload(msg: DiscordMessage) -> str {
    return "{\"username\":\"" + msg.username + "\",\"content\":\"" + msg.content + "\"}";
}

fn send_webhook(url: str, msg: DiscordMessage) -> bool {
    let payload: str = format_payload(msg);
    let cmd: str = "curl -s -H \"Content-Type: application/json\" -X POST -d '" + payload + "' \"" + url + "\"";
    return system(cmd) == 0;
}

function main() {
    let msg: DiscordMessage = DiscordMessage {
        username: "VektorBot",
        content: "Hello from Vektor!"
    };
    send_webhook("https://discord.com/api/webhooks/YOUR_URL", msg);
}
```

---

## 25. Package Manager (vk_modules)

### Initialize a Project
```bash
npx tsx src/main.ts --init my-project
```

Creates:
```
my-project/
├── vektor.json
└── main.vk
```

### vektor.json Format
```json
{
  "name": "my-project",
  "version": "1.0.0",
  "entry": "main.vk",
  "dependencies": {}
}
```

### Install a Local Package
```bash
npx tsx src/main.ts --add ../path/to/my-lib
```

### Import Installed Package
```vks
import "my-lib";  // vk_modules/my-lib/main.vk
```

---

## 26. Execution Modes

| Mode | Flag | Speed | Use Case |
|------|------|-------|----------|
| **Bytecode VM** | `--run` | Fast | All normal use — recommended |
| **AST Interpreter** | `--run-ast` | Slow | Debugging, quick testing |
| **Compile to .vkb** | `--compile` | N/A | Save bytecode for later |
| **Execute .vkb** | `--exec` | Fast | Run saved bytecode |
| **Native (LLVM)** | `--build` | Fastest | Production executables |

```bash
npx tsx src/main.ts my_program.vk --run       # VM mode
npx tsx src/main.ts my_program.vk --run-ast   # AST mode
npx tsx src/main.ts my_program.vk --compile   # Compile to .vkb
npx tsx src/main.ts my_program.vkb --exec     # Run .vkb
```

---

## 27. Complete Example Programs

### Example 1 — Hello World
```vks
function main() {
    print("Hello from Vektor");
}
```

### Example 2 — Math & Recursion
```vks
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

fn factorial(n: i32) -> i32 {
    if n <= 1 { return 1; }
    return n * factorial(n - 1);
}

function main() {
    print(add(10, 20));    // 30
    print(factorial(5));   // 120
    print(factorial(10));  // 3628800
}
```

### Example 3 — Structs, Results, Loops, Casting, Ownership
```vks
struct Player {
    name: str;
    score: i32;
    alive: bool;
}

fn get_rank(score: i32) -> Result<str, str> {
    if score < 0 { return Err("Score cannot be negative"); }
    if score >= 90 { return Ok("S Rank"); }
    if score >= 75 { return Ok("A Rank"); }
    return Ok("B Rank");
}

function main() {
    let p: Player = Player { name: "Vektor", score: 95, alive: true };
    print(p.name);

    let rank = get_rank(p.score);
    if rank.ok {
        print(rank.value);  // S Rank
    } else {
        print(rank.error);
    }

    // Nullable
    let y: i32? = null;
    if y != null {
        print(y);
    } else {
        print("y is null");
    }

    // Range loop + sum
    let sum: i32 = 0;
    for i in 1..6 {
        sum = sum + i;
    }
    print("Sum 1..5 = " + toString(sum)); // Sum 1..5 = 15

    // Casting
    let a: f32 = 3.14;
    let b: i32 = cast<i32>(a);
    print(b); // 3

    // Ownership
    let original: str = "Vektor";
    let copy: str = clone(original);
    print(original);
    print(copy);
}
```

### Example 4 — Manual Memory
```vks
function main() {
    let buffer: ptr<byte> = alloc(256);
    buffer[0] = 'V';
    buffer[1] = 'K';
    buffer[2] = 'S';
    print(buffer[0]); // V
    print(buffer[1]); // K
    print(buffer[2]); // S
    free(buffer);     // always

    let val: i32 = 42;
    let p: ptr<i32> = &val;
    let deref: i32 = *p;
    print(deref); // 42
}
```

### Example 5 — Math Library
```vks
import "math.vk";

function calculate_score(priority: i32, base: f64) -> f64 {
    let factor: f64 = cast<f64>(priority) * 1.5;
    return pow(base, 2.0) + factor;
}

function main() {
    let s1: f64 = calculate_score(5, 4.0);  // 23.5
    let s2: f64 = calculate_score(3, 3.0);  // 13.5
    print(toString(s1));
    print(toString(s2));
    print(toString(max(cast<i32>(s1), cast<i32>(s2)))); // 23
    print(toString(clamp(5, 0, 10)));                   // 5
}
```

### Example 6 — Discord Webhook Bot
```vks
import "io.vk";
import "string.vk";
import "os.vk";

struct DiscordMessage {
    username: str;
    content: str;
    avatar_url: str;
}

fn format_discord_payload(msg: DiscordMessage) -> str {
    return "{\"username\":\"" + msg.username + "\",\"content\":\"" + msg.content + "\"}";
}

fn send_discord_webhook(webhook_url: str, msg: DiscordMessage) -> bool {
    let payload: str = format_discord_payload(msg);
    let cmd: str = "curl -s -H \"Content-Type: application/json\" -X POST -d '" + payload + "' \"" + webhook_url + "\"";
    return system(cmd) == 0;
}

function main() {
    let bot_msg: DiscordMessage = DiscordMessage {
        username: "VektorBot",
        content: "Hello from Vektor Programming Language!",
        avatar_url: "https://vks-lang.dev/logo.png"
    };
    print(format_discord_payload(bot_msg));
}
```

---

## 28. Reserved Keywords

```
let        const      function   fn         return
if         else       while      for        in
struct     true       false      null       and
or         not        import     alloc      free
cast       Result     Ok         Err        ptr
void       bool       byte       str        i8
i16        i32        i64        f32        f64
clone      move       spawn      Thread     Mutex
Socket     Map        Box
```

---

## 29. AI Coding Assistant Prompt Guide

> 📢 **Paste this block at the start of any AI conversation to get correct Vektor code.**

```
You are writing code in Vektor (.vk), a brand new statically-typed compiled programming language.

CRITICAL RULES:
- File extension: .vk
- Entry point: function main() { ... }
- Variables: let name: type = value;
- Constants: const NAME: type = value;
- Functions: fn name(param: type) -> ReturnType { ... }
- Types: i8, i16, i32, i64, f32, f64, bool, byte, str, ptr<T>
- NO type inference — types always explicit
- NO implicit casting — use cast<T>(value)
- String concat: "text" + toString(number)
- str is immutable. Access via .len and .bytes
- Nullable: let x: i32? = null;  Check: if x != null { ... }
- Result: fn foo() -> Result<i32, str>
  Return success: return Ok(value);
  Return error: return Err("message");
  Check: if result.ok { result.value } else { result.error }
- Boolean: && or "and",  || or "or",  ! or "not"
- Loops: while x < n { }, for (let i: i32 = 0; i < n; i++) { }, for i in 0..n { }
- Arrays: let a: i32[5] = [1,2,3,4,5]; Access: a[0]
- Structs: struct Name { field: type; }   Instance: Name { field: value }
- Pointers: let p: ptr<i32> = &x;  let v: i32 = *p;
- Heap: let b: ptr<byte> = alloc(256);  free(b);
- Clone: let b: str = clone(a);
- Imports: import "io.vk"; import "math.vk"; import "string.vk"; import "os.vk"; import "net.vk";
- print() always available without import
- STRICT: NO Python, NO JavaScript, NO Node.js, NO shell scripts. Pure .vk only.
```

### Good Prompt Format
```
Write a Vektor (.vk) function that takes a score: i32 and returns Result<str, str>
with the letter grade ("S Rank", "A Rank", "B Rank") or an error if score is negative.
Use the Vektor Result<T,E> pattern with Ok() and Err().
```

### If AI Produces Wrong Language
Paste this correction:
```
This must be pure Vektor (.vk) code only. No JavaScript, Python, or TypeScript.
Use "fn" or "function" for functions. Declare every variable as: let name: type = value;
```

---

## 30. Common Mistakes & Gotchas

### Mistake 1 — Missing Type Annotation
```vks
let x = 10;        // Error: type required
let x: i32 = 10;  // Correct
```

### Mistake 2 — Implicit Casting
```vks
let a: i32 = 5;
let b: f64 = a;            // Error: implicit cast
let b: f64 = cast<f64>(a); // Correct
```

### Mistake 3 — Concatenating Non-Strings
```vks
print("Score: " + 95);             // Error
print("Score: " + toString(95));   // Correct
```

### Mistake 4 — i++ Outside a For Loop
```vks
let i: i32 = 0;
i++;          // Error: only valid in for-loop update
i = i + 1;   // Correct everywhere
```

### Mistake 5 — Using Nullable Without Null Check
```vks
let y: i32? = null;
print(y);           // Dangerous
if y != null {
    print(y);       // Safe
}
```

### Mistake 6 — Forgetting to Free Memory
```vks
let buf: ptr<byte> = alloc(256);
buf[0] = 'V';
// Memory leak — forgot free()
free(buf);  // Always required
```

### Mistake 7 — Using Value After Ownership Move
```vks
let a: str = "Vektor";
let b: str = a;  // a is now invalid
print(a);        // Error

let b: str = clone(a);  // Correct: a still valid
print(a);
```

### Mistake 8 — Block Comments
```vks
/* This doesn't work */  // Error
// Use single-line only  // Correct
```

### Mistake 9 — Accessing result.value Without Checking ok
```vks
let r = divide(10, 0);
print(r.value);     // Dangerous
if r.ok {
    print(r.value); // Safe
}
```

### Mistake 10 — Import After Code
```vks
fn something() { ... }
import "math.vk"; // Error — must come first

// Correct order:
import "math.vk";
fn something() { ... }
```

---

## 📌 Quick Reference Card

```
TYPES:       i8 i16 i32 i64 f32 f64 bool byte str ptr<T>
NULLABLE:    let x: i32? = null;
VARIABLE:    let name: i32 = 0;
CONSTANT:    const MAX: i32 = 100;
FUNCTION:    fn add(a: i32, b: i32) -> i32 { return a + b; }
ENTRY:       function main() { ... }
IF:          if x > 5 { ... } else if x > 0 { ... } else { ... }
WHILE:       while i < 10 { i = i + 1; }
FOR:         for (let i: i32 = 0; i < 10; i++) { ... }
FOR-IN:      for i in 0..10 { ... }
STRUCT:      struct Point { x: f32; y: f32; }
INSTANCE:    let p: Point = Point { x: 1.0, y: 2.0 };
OK:          return Ok(value);
ERR:         return Err("message");
RESULT:      if result.ok { result.value } else { result.error }
CAST:        cast<f64>(my_i32)
POINTER:     let p: ptr<i32> = &x;   let v: i32 = *p;
HEAP:        let buf: ptr<byte> = alloc(256);   free(buf);
CLONE:       let b: str = clone(a);
IMPORT:      import "math.vk";
PRINT:       print("hello");   print(toString(42));
CONCAT:      "Score: " + toString(95)
BOOL:        && and   || or   ! not
COMMENT:     // single line only
```

---

*Vektor — Built from nothing. Foundation for everything.*

*Language created by Anshuman (Boss). This Knowledge Book is part of the official Vektor repository.*
