import { VM, VMPointer } from "./src/vm.js";
import { Compiler } from "./src/compiler.js";
import { parseFile } from "./src/main.js";
import fs from "fs";

function test() {
  const ast = parseFile("vks-compiler/compiler.vks");
  const compiler = new Compiler();
  const program = compiler.compile(ast);
  
  const vm = new VM();
  try {
    vm.run(program);
  } catch (e: any) {
    console.error("VM Run Error:", e.message);
  }
  const globalCompiler = vm.lastValue;
  console.log("Returned Compiler:", globalCompiler);
  if (globalCompiler instanceof VMPointer) {
    const chunkPtr = vm.heap.get(globalCompiler.address)?.fields.get("chunk");
    console.log("Chunk Ptr:", chunkPtr);
    if (chunkPtr instanceof VMPointer) {
      const chunkData = vm.heap.get(chunkPtr.address);
      console.log("Chunk Data Name:", chunkData?.fields.get("name"));
    }
  }
}
test();
