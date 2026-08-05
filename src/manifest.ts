// ============================================================
// Vektor — Package Manifest Manager (vektor.json)
// ============================================================

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

export interface VektorManifest {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
}

export const MANIFEST_FILENAME = "vektor.json";

export function readManifest(dirPath: string): VektorManifest | null {
  const manifestPath = resolve(dirPath, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    return JSON.parse(raw) as VektorManifest;
  } catch (err: any) {
    throw new Error(`Failed to parse ${MANIFEST_FILENAME} at ${manifestPath}: ${err.message}`);
  }
}

export function writeManifest(dirPath: string, manifest: VektorManifest): void {
  const manifestPath = resolve(dirPath, MANIFEST_FILENAME);
  const json = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(manifestPath, json, "utf-8");
}

export function createDefaultManifest(dirPath: string): VektorManifest {
  const folderName = basename(resolve(dirPath)).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return {
    name: folderName || "my-vektor-app",
    version: "0.1.0",
    description: "A Vektor application",
    main: "main.vk",
    dependencies: {}
  };
}
