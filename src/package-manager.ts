// ============================================================
// Vektor — Package Manager Subsystem
// ============================================================

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname, basename, join } from "path";
import { execSync } from "child_process";
import {
  MANIFEST_FILENAME,
  readManifest,
  writeManifest,
  createDefaultManifest,
  VektorManifest
} from "./manifest.js";

export const MODULES_DIR = "vk_modules";

export function initProject(cwd: string): VektorManifest {
  let manifest = readManifest(cwd);
  if (manifest) {
    console.log(`  ✓ ${MANIFEST_FILENAME} already exists in ${cwd}`);
    return manifest;
  }

  manifest = createDefaultManifest(cwd);
  writeManifest(cwd, manifest);
  console.log(`  ✓ Initialized Vektor project '${manifest.name}' (${MANIFEST_FILENAME})`);

  const entryFile = resolve(cwd, manifest.main || "main.vk");
  if (!existsSync(entryFile)) {
    const starterCode = `// ${manifest.name} — Entry Point\n\nfunction main() {\n  print("Hello from ${manifest.name}!");\n}\n`;
    writeFileSync(entryFile, starterCode, "utf-8");
    console.log(`  ✓ Created starter entry file '${manifest.main || "main.vk"}'`);
  }

  return manifest;
}

export function addAndInstall(cwd: string, source: string): string {
  let manifest = readManifest(cwd);
  if (!manifest) {
    manifest = initProject(cwd);
  }

  const modulesPath = resolve(cwd, MODULES_DIR);
  if (!existsSync(modulesPath)) {
    mkdirSync(modulesPath, { recursive: true });
  }

  let pkgName = "";
  let targetPath = "";

  const isLocal = source.startsWith(".") || source.startsWith("/") || existsSync(resolve(cwd, source));

  if (isLocal) {
    const absSource = resolve(cwd, source);
    if (!existsSync(absSource)) {
      throw new Error(`Local package path '${source}' does not exist.`);
    }

    const pkgManifest = readManifest(absSource);
    pkgName = pkgManifest?.name || basename(absSource).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    targetPath = resolve(modulesPath, pkgName);

    if (existsSync(targetPath)) {
      execSync(`rm -rf "${targetPath}"`);
    }

    cpSync(absSource, targetPath, {
      recursive: true,
      filter: (src) => !src.includes("node_modules") && !src.includes(".git") && !src.includes(MODULES_DIR)
    });

    console.log(`  ✓ Installed local package '${pkgName}' -> ${MODULES_DIR}/${pkgName}`);
  } else {
    // Git repository URL
    const rawName = basename(source, ".git").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    pkgName = rawName;
    targetPath = resolve(modulesPath, pkgName);

    if (existsSync(targetPath)) {
      execSync(`rm -rf "${targetPath}"`);
    }

    console.log(`  ↓ Cloning '${source}' into ${MODULES_DIR}/${pkgName}...`);
    execSync(`git clone --depth 1 "${source}" "${targetPath}"`, { stdio: "inherit" });
    console.log(`  ✓ Cloned '${pkgName}' successfully.`);
  }

  if (!manifest.dependencies) {
    manifest.dependencies = {};
  }
  manifest.dependencies[pkgName] = source;
  writeManifest(cwd, manifest);

  return pkgName;
}

export function installAll(cwd: string): void {
  const manifest = readManifest(cwd);
  if (!manifest || !manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
    console.log(`  ✓ No dependencies listed in ${MANIFEST_FILENAME}`);
    return;
  }

  console.log(`  📦 Installing dependencies for '${manifest.name}'...`);
  for (const [name, source] of Object.entries(manifest.dependencies)) {
    const targetPath = resolve(cwd, MODULES_DIR, name);
    if (!existsSync(targetPath)) {
      addAndInstall(cwd, source);
    } else {
      console.log(`  ✓ Package '${name}' is already installed.`);
    }
  }
  console.log(`  ✓ All dependencies up to date.`);
}

export function resolvePackageEntry(projectRoot: string, packageName: string): string {
  const pkgDir = resolve(projectRoot, MODULES_DIR, packageName);
  if (!existsSync(pkgDir)) {
    throw new Error(`Package '${packageName}' is not installed in ${MODULES_DIR}/. Run 'vektor install ${packageName}' first.`);
  }

  const pkgManifest = readManifest(pkgDir);
  const mainFile = pkgManifest?.main || "index.vk";

  let resolvedEntry = resolve(pkgDir, mainFile);
  if (!existsSync(resolvedEntry) && !resolvedEntry.endsWith(".vk")) {
    resolvedEntry = resolvedEntry + ".vk";
  }

  if (!existsSync(resolvedEntry)) {
    const fallbackMain = resolve(pkgDir, "main.vk");
    if (existsSync(fallbackMain)) {
      return fallbackMain;
    }
    throw new Error(`Cannot find entry point '${mainFile}' for package '${packageName}' at ${pkgDir}`);
  }

  return resolvedEntry;
}
