// src/package-manager.ts
// Implements `vks init` and `vks install` — pulls dependencies into vks_modules/

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  loadManifest, writeManifest, createDefaultManifest, manifestExists, ViktorManifest,
} from "./manifest.js";

const MODULES_DIR = "vks_modules";

export function modulesPath(projectRoot: string): string {
  return path.join(projectRoot, MODULES_DIR);
}

// ---------- vks init ----------

export function initProject(projectRoot: string): void {
  if (manifestExists(projectRoot)) {
    console.log("viktor.json already exists. Skipping init.");
    return;
  }
  const folderName = path.basename(projectRoot);
  const manifest = createDefaultManifest(projectRoot, folderName);

  // Scaffold entry file if it doesn't exist
  const entryPath = path.join(projectRoot, manifest.entry);
  if (!fs.existsSync(entryPath)) {
    fs.writeFileSync(
      entryPath,
      `function main() {\n    print("Hello from ${folderName}");\n}\n`,
      "utf-8"
    );
  }

  console.log(`Initialized Viktor Script project "${manifest.name}" at ${projectRoot}`);
  console.log(`Created viktor.json and ${manifest.entry}`);
}

// ---------- vks install ----------

function isLocalPath(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../") || source.startsWith("/");
}

function installSingleDependency(projectRoot: string, name: string, source: string): void {
  const dest = path.join(modulesPath(projectRoot), name);

  if (fs.existsSync(dest)) {
    console.log(`  ${name} — already installed, skipping`);
    return;
  }

  fs.mkdirSync(modulesPath(projectRoot), { recursive: true });

  if (isLocalPath(source)) {
    const absSource = path.resolve(projectRoot, source);
    if (!fs.existsSync(absSource)) {
      throw new Error(`Local dependency path does not exist: ${absSource}`);
    }
    fs.cpSync(absSource, dest, { recursive: true });
    console.log(`  ${name} — copied from local path ${source}`);
  } else {
    // Treat as a git URL
    console.log(`  ${name} — cloning from ${source}...`);
    execSync(`git clone --depth 1 "${source}" "${dest}"`, { stdio: "inherit" });
  }

  // If the installed package has its own dependencies, install those too (recursive)
  const nestedManifestPath = path.join(dest, "viktor.json");
  if (fs.existsSync(nestedManifestPath)) {
    const nestedManifest: ViktorManifest = JSON.parse(fs.readFileSync(nestedManifestPath, "utf-8"));
    if (nestedManifest.dependencies) {
      for (const [depName, depSource] of Object.entries(nestedManifest.dependencies)) {
        installSingleDependency(projectRoot, depName, depSource);
      }
    }
  }
}

export function installAll(projectRoot: string): void {
  const manifest = loadManifest(projectRoot);
  const deps = manifest.dependencies ?? {};
  const names = Object.keys(deps);

  if (names.length === 0) {
    console.log("No dependencies listed in viktor.json.");
    return;
  }

  console.log(`Installing ${names.length} dependenc${names.length === 1 ? "y" : "ies"}...`);
  for (const name of names) {
    installSingleDependency(projectRoot, name, deps[name]);
  }
  console.log("Done.");
}

export function addAndInstall(projectRoot: string, source: string, nameOverride?: string): void {
  const manifest = loadManifest(projectRoot);
  const name = nameOverride ?? inferNameFromSource(source);

  manifest.dependencies = manifest.dependencies ?? {};
  manifest.dependencies[name] = source;
  writeManifest(projectRoot, manifest);

  console.log(`Added "${name}" -> ${source} to viktor.json`);
  installSingleDependency(projectRoot, name, source);
}

function inferNameFromSource(source: string): string {
  // github.com/someone/vks-math-utils.git -> vks-math-utils
  const base = source.replace(/\.git$/, "").split("/").pop();
  if (!base) throw new Error(`Could not infer package name from "${source}". Provide one explicitly.`);
  return base;
}

// ---------- Resolve a package's entry file (used by the import resolver) ----------

export function resolvePackageEntry(projectRoot: string, packageName: string): string {
  const pkgDir = path.join(modulesPath(projectRoot), packageName);
  const pkgManifestPath = path.join(pkgDir, "viktor.json");

  if (fs.existsSync(pkgManifestPath)) {
    const pkgManifest: ViktorManifest = JSON.parse(fs.readFileSync(pkgManifestPath, "utf-8"));
    return path.join(pkgDir, pkgManifest.entry);
  }

  // Fallback convention if the package has no manifest: look for index.vks
  const fallback = path.join(pkgDir, "index.vks");
  if (fs.existsSync(fallback)) return fallback;

  throw new Error(
    `Cannot resolve package "${packageName}" — no viktor.json or index.vks found in ${pkgDir}`
  );
}
