// ============================================================
// Vektor — Environment (Scope & Variables)
// ============================================================
// A chain of scoped symbol tables for variable resolution.
// Each block/function creates a child environment that can see
// its parent's bindings via the prototype chain.
// ============================================================

import { VKSValue } from "./values.js";

/** Metadata for a variable binding. */
interface Binding {
  value: VKSValue;
  isConst: boolean;
  isMoved: boolean;
}

/**
 * A scoped environment for storing variable bindings.
 * Child environments delegate lookups to their parent,
 * implementing lexical scoping.
 */
export class Environment {
  private readonly bindings: Map<string, Binding> = new Map();
  readonly parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  /**
   * Define a new variable in the current scope.
   * Throws if the variable is already defined in this scope.
   */
  define(name: string, value: VKSValue, isConst: boolean = false): void {
    if (this.bindings.has(name)) {
      throw new Error(`Variable '${name}' is already defined in this scope.`);
    }
    this.bindings.set(name, { value, isConst, isMoved: false });
  }

  /**
   * Look up a variable by name, walking the parent chain.
   * Throws if the variable is not found or has been moved.
   */
  get(name: string): VKSValue {
    const binding = this.resolve(name);
    if (!binding) {
      throw new Error(`Undefined variable '${name}'.`);
    }
    if (binding.isMoved) {
      throw new Error(
        `Variable '${name}' has been moved and can no longer be accessed. Use clone() to keep both copies.`
      );
    }
    return binding.value;
  }

  /**
   * Reassign an existing variable.
   * Throws on: const reassignment, undefined variable, moved variable.
   */
  set(name: string, value: VKSValue): void {
    const env = this.findOwner(name);
    if (!env) {
      throw new Error(`Undefined variable '${name}'. Cannot assign to an undeclared variable.`);
    }
    const binding = env.bindings.get(name)!;
    if (binding.isConst) {
      throw new Error(`Cannot reassign constant '${name}'.`);
    }
    // Reassigning a moved variable is allowed — it restores it
    binding.value = value;
    binding.isMoved = false;
  }

  /**
   * Mark a variable as moved (ownership transferred).
   */
  markMoved(name: string): void {
    const env = this.findOwner(name);
    if (env) {
      const binding = env.bindings.get(name)!;
      binding.isMoved = true;
    }
  }

  /**
   * Check if a variable is defined (in this scope or any parent).
   */
  has(name: string): boolean {
    return this.resolve(name) !== null;
  }

  /**
   * Check if a variable is a constant.
   */
  isConst(name: string): boolean {
    const binding = this.resolve(name);
    return binding ? binding.isConst : false;
  }

  /**
   * Resolve a binding by walking the scope chain.
   * Returns null if not found.
   */
  private resolve(name: string): Binding | null {
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }
    if (this.parent) {
      return this.parent.resolve(name);
    }
    return null;
  }

  /**
   * Find the environment that directly owns a binding.
   */
  private findOwner(name: string): Environment | null {
    if (this.bindings.has(name)) {
      return this;
    }
    if (this.parent) {
      return this.parent.findOwner(name);
    }
    return null;
  }
}
