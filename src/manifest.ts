// src/manifest.ts
// Parses and validates viktor.json — the package manifest for a Viktor Script project.

import * as fs from "fs";
import * as path from "path";

export interface ViktorManifest {
  name: string;
  version: string;
  entry: string;
  dependencies?: Record<string, string>; // name -> git URL or local path
}

const MANIFEST_FILENAME = "viktor.json";

export function manifestPath(projectRoot: string): string {
  return path.join(projectRoot, MANIFEST_FILENAME);
}

export function manifestExists(projectRoot: string): boolean {
  return fs.existsSync(manifestPath(projectRoot));
}

export function loadManifest(projectRoot: string): ViktorManifest {
  const p = manifestPath(projectRoot);
  if (!fs.existsSync(p)) {
    throw new Error(`No viktor.json found in ${projectRoot}. Run "vks init" first.`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw);

  if (!data.name || !data.version || !data.entry) {
    throw new Error(`viktor.json is missing required fields: name, version, entry`);
  }

  return {
    name: data.name,
    version: data.version,
    entry: data.entry,
    dependencies: data.dependencies ?? {},
  };
}

export function writeManifest(projectRoot: string, manifest: ViktorManifest): void {
  const p = manifestPath(projectRoot);
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

export function createDefaultManifest(projectRoot: string, name: string): ViktorManifest {
  const manifest: ViktorManifest = {
    name,
    version: "1.0.0",
    entry: "main.vks",
    dependencies: {},
  };
  writeManifest(projectRoot, manifest);
  return manifest;
}
