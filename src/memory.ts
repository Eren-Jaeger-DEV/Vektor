// ============================================================
// Viktor Script — Memory Heap (Pointer Simulation)
// ============================================================
// Simulates heap memory for alloc/free/&/* operations.
// Since we're in interpreted mode, real addresses don't exist
// — we assign virtual addresses and track allocations.
// ============================================================

import { VKSValue, mkByte, mkNull } from "./values.js";

/** A single heap allocation block. */
interface HeapBlock {
  /** Starting virtual address */
  address: number;
  /** Number of slots in this block */
  size: number;
  /** The stored values (indexed 0..size-1) */
  data: VKSValue[];
  /** Whether this block has been freed */
  freed: boolean;
}

/** A reference-backed pointer (for &variable). */
interface VarRef {
  /** Getter to read the current value */
  get: () => VKSValue;
  /** Setter to write a new value */
  set: (value: VKSValue) => void;
}

/**
 * Simulated heap for Viktor Script interpreted mode.
 * Tracks allocations and provides virtual addresses.
 */
export class MemoryHeap {
  /** All allocated blocks, keyed by starting address */
  private blocks: Map<number, HeapBlock> = new Map();

  /** Variable references for &var pointers */
  private varRefs: Map<number, VarRef> = new Map();

  /** Next available virtual address */
  private nextAddress: number = 0x1000;

  /**
   * Allocate a block of `size` slots on the heap.
   * Returns the starting virtual address.
   */
  alloc(size: number): number {
    if (size <= 0) {
      throw new Error("Cannot allocate zero or negative bytes.");
    }

    const address = this.nextAddress;
    this.nextAddress += size + 0x100; // leave gaps for realism

    const data: VKSValue[] = new Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = mkByte(0); // zero-initialized
    }

    this.blocks.set(address, {
      address,
      size,
      data,
      freed: false,
    });

    return address;
  }

  /**
   * Free a previously allocated block.
   * Errors on double-free or invalid address.
   */
  free(address: number): void {
    const block = this.blocks.get(address);
    if (!block) {
      // Check if it's a var-ref pointer — those can't be freed
      if (this.varRefs.has(address)) {
        throw new Error(
          `Cannot free address 0x${address.toString(16)}: this points to a stack variable, not heap memory.`
        );
      }
      throw new Error(`Cannot free address 0x${address.toString(16)}: no allocation found at this address.`);
    }
    if (block.freed) {
      throw new Error(`Double free detected at address 0x${address.toString(16)}.`);
    }
    block.freed = true;
  }

  /**
   * Read a value from a heap block at the given offset.
   */
  read(address: number, offset: number): VKSValue {
    // Check var-ref first
    if (offset === 0 && this.varRefs.has(address)) {
      return this.varRefs.get(address)!.get();
    }

    const block = this.findBlock(address);
    if (block.freed) {
      throw new Error(`Use-after-free: memory at 0x${address.toString(16)} has been freed.`);
    }

    const index = address - block.address + offset;
    if (index < 0 || index >= block.size) {
      throw new Error(
        `Out-of-bounds memory access: offset ${offset} at address 0x${address.toString(16)} (block size: ${block.size}).`
      );
    }

    return block.data[index];
  }

  /**
   * Write a value to a heap block at the given offset.
   */
  write(address: number, offset: number, value: VKSValue): void {
    // Check var-ref first
    if (offset === 0 && this.varRefs.has(address)) {
      this.varRefs.get(address)!.set(value);
      return;
    }

    const block = this.findBlock(address);
    if (block.freed) {
      throw new Error(`Use-after-free: memory at 0x${address.toString(16)} has been freed.`);
    }

    const index = address - block.address + offset;
    if (index < 0 || index >= block.size) {
      throw new Error(
        `Out-of-bounds memory access: offset ${offset} at address 0x${address.toString(16)} (block size: ${block.size}).`
      );
    }

    block.data[index] = value;
  }

  /**
   * Create a virtual address that references a variable binding.
   * Used for the & (address-of) operator on stack variables.
   */
  addressOf(get: () => VKSValue, set: (value: VKSValue) => void): number {
    const address = this.nextAddress;
    this.nextAddress += 0x10;
    this.varRefs.set(address, { get, set });
    return address;
  }

  /**
   * Dereference a virtual address to get its value.
   * Works for both heap blocks (offset 0) and variable refs.
   */
  deref(address: number): VKSValue {
    // Check var-ref first
    if (this.varRefs.has(address)) {
      return this.varRefs.get(address)!.get();
    }

    // Fall back to heap block read
    return this.read(address, 0);
  }

  /**
   * Write through a dereferenced pointer.
   */
  derefSet(address: number, value: VKSValue): void {
    if (this.varRefs.has(address)) {
      this.varRefs.get(address)!.set(value);
      return;
    }

    this.write(address, 0, value);
  }

  /**
   * Find the heap block that contains the given address.
   */
  private findBlock(address: number): HeapBlock {
    // Direct lookup first
    if (this.blocks.has(address)) {
      return this.blocks.get(address)!;
    }

    // Search for a block that contains this address
    for (const block of this.blocks.values()) {
      if (address >= block.address && address < block.address + block.size) {
        return block;
      }
    }

    throw new Error(`Invalid memory access: no allocation contains address 0x${address.toString(16)}.`);
  }
}
