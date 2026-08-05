# Wiring the Package Manager into Vektor

Two files were created:
- `src/manifest.ts` — reads/writes `vektor.json`
- `src/package-manager.ts` — implements `vks init`, `vks install`, `vks install <git-url>`

You need to make two small edits yourself, since they touch your existing `main.ts` and
import resolver, which I don't have in front of me.

---

## 1. Add CLI commands to `src/main.ts`

Near the top of your CLI argument handling, before the existing `.vk` file logic, add:

```typescript
import { initProject, installAll, addAndInstall } from "./package-manager.js";

const cliArgs = process.argv.slice(2);
const cwd = process.cwd();

if (cliArgs[0] === "init") {
  initProject(cwd);
  process.exit(0);
}

if (cliArgs[0] === "install") {
  if (cliArgs[1]) {
    // vks install https://github.com/someone/vks-math-utils.git
    addAndInstall(cwd, cliArgs[1]);
  } else {
    // vks install (reads vektor.json, installs everything)
    installAll(cwd);
  }
  process.exit(0);
}

// ... your existing --run / --compile / --exec / --llvm logic continues below
```

Now these work:
```bash
npx tsx src/main.ts init
npx tsx src/main.ts install
npx tsx src/main.ts install https://github.com/someone/vks-math-utils.git
```

---

## 2. Patch the import resolver

Find wherever your code currently resolves `import "..."` strings — likely in
`src/main.ts` or a dedicated `resolveImports()` function, used both by the TS compiler
and referenced conceptually by `vektor-compiler/main.vk`'s self-hosted resolver.

The current logic probably does something like:
```typescript
const importedPath = path.resolve(path.dirname(currentFile), importString);
```

Change it to branch on whether the import is relative or bare:

```typescript
import { resolvePackageEntry } from "./package-manager.js";

function resolveImportPath(importString: string, currentFile: string, projectRoot: string): string {
  const isRelative = importString.startsWith("./") || importString.startsWith("../");

  if (isRelative) {
    // existing behavior — unchanged
    return path.resolve(path.dirname(currentFile), importString);
  }

  // bare import like `import "math-utils";` -> look in vk_modules/
  // strip a trailing .vk if present, since package names don't include it
  const packageName = importString.replace(/\.vk$/, "");
  return resolvePackageEntry(projectRoot, packageName);
}
```

Then anywhere you currently call `path.resolve(...)` directly for an import, call
`resolveImportPath(importString, currentFile, projectRoot)` instead.

`projectRoot` should be the directory containing the project's own `vektor.json` —
typically `process.cwd()` when running the CLI, or whatever directory you already
treat as the entry point's root.

---

## 3. Test it end-to-end

```bash
# Create a tiny "library" project
mkdir vks-math-utils && cd vks-math-utils
npx tsx ../src/main.ts init
echo 'fn square(x: i32) -> i32 { return x * x; }' > index.vk
cd ..

# Create a project that depends on it (using local path for a quick test)
mkdir my-app && cd my-app
npx tsx ../src/main.ts init
npx tsx ../src/main.ts install ../vks-math-utils

# Use it
cat > main.vk << 'EOF'
import "vks-math-utils";

function main() {
    print(square(5));
}
EOF

npx tsx ../src/main.ts main.vk --run
# Expect: 25
```

If that prints `25`, the package system works end-to-end — local dependency, resolved
through `vk_modules/`, imported by bare name, executed correctly.

Once that's confirmed, swap the local path for a real GitHub URL and the git-clone path
in `package-manager.ts` takes over automatically.
