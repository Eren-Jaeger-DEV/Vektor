import { randomUUID } from "crypto";
import { resolve } from "path";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { VM } from "./vm.js";
import { Serializer } from "./serializer.js";

export function compileToVM(source: string) {
  const id = randomUUID();
  const vksPath = resolve(process.cwd(), `test_${id}.vks`);
  const vkbPath = resolve(process.cwd(), `test_${id}.vkb`);
  
  writeFileSync(vksPath, source);
  
  const compilerPath = resolve(process.cwd(), "compiler.vkb");
  if (!existsSync(compilerPath)) {
    throw new Error("compiler.vkb not found. Ensure the compiler is bootstrapped!");
  }

  const compilerBuffer = readFileSync(compilerPath);
  const serializer = new Serializer();
  const compilerProg = serializer.deserialize(compilerBuffer);

  (global as any).__vks_args = [vksPath, vkbPath];
  const vmCompile = new VM();
  
  try {
    vmCompile.run(compilerProg);
  } catch(e: any) {
    console.log(`[TEST TRACE] ERROR compiling: ${e.message}`);
    throw e;
  }

  if (!existsSync(vkbPath)) {
    if (existsSync(vksPath)) unlinkSync(vksPath);
    throw new Error("Failed to compile source to " + vkbPath);
  }

  const targetBuffer = readFileSync(vkbPath);
  const compiledProgram = serializer.deserialize(targetBuffer);
  
  unlinkSync(vksPath);
  unlinkSync(vkbPath);
  
  return compiledProgram;
}
