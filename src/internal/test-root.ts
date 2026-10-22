import { createRoot, flushSync } from "@shadow-js/core";
import { register } from "./registry";

/**
 * A root created by {@link createTestRoot}: the value its setup returned, and the teardown.
 * @see createTestRoot
 * @since 1.0.0
 */
export interface TestRoot<T> {
  /** Whatever the setup function returned. */
  readonly value: T;
  /** Disposes the root and runs its cleanups. Safe to call more than once. */
  dispose(): void;
}

/**
 * Runs `setup` inside a fresh ownership root, flushes its effects, and returns its value with a
 * dispose function. Use it to test state or effects without a component. The root is also disposed
 * by {@link cleanup}, so a forgotten root cannot leak past its test.
 *
 * @param setup Runs untracked inside the root's owner. Cleanups it registers run on dispose.
 * @returns The setup value and the dispose function.
 * @example
 * import { createTestRoot } from "@shadow-js/testing";
 * import { onCleanup, useSignal } from "@shadow-js/core";
 * import { expect, it } from "vitest";
 *
 * it("runs cleanups on dispose", () => {
 *   let closed = false;
 *   const root = createTestRoot(() => {
 *     onCleanup(() => {
 *       closed = true;
 *     });
 *     return useSignal(0);
 *   });
 *   root.dispose();
 *   expect(closed).toBe(true);
 * });
 * @see cleanup
 * @since 1.0.0
 */
export function createTestRoot<T>(setup: () => T): TestRoot<T> {
  const made = createRoot((dispose) => ({ value: setup(), dispose }));
  const dispose = register(made.dispose);
  flushSync();
  return { value: made.value, dispose };
}
