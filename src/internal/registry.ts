/**
 * Teardowns of everything the test helpers mounted and have not yet disposed: DOM renders, test
 * roots and hook roots. `cleanup()` runs what is left. The set is module state on purpose, because
 * cleanup has to know about every mount made since its last call.
 */
const teardowns = new Set<() => void>();

/**
 * Registers `teardown` so that {@link cleanup} runs it. The returned function runs the teardown at
 * most once and unregisters it, so calling it again, or after `cleanup()`, does nothing.
 * @internal
 */
export function register(teardown: () => void): () => void {
  let done = false;
  const run = (): void => {
    if (done) return;
    done = true;
    teardowns.delete(run);
    teardown();
  };
  teardowns.add(run);
  return run;
}

/**
 * Disposes everything still mounted by this package (renders, test roots and hook roots), most
 * recent first. Call it after each test unless `@shadow-js/testing/auto-cleanup` does it for you.
 * Safe to call at any time and any number of times.
 *
 * @throws The error a teardown threw, as it was thrown, when exactly one teardown fails. Every
 * other teardown still runs first.
 * @throws {AggregateError} The errors in the order the teardowns ran, when two or more fail.
 * @example
 * import { cleanup } from "@shadow-js/testing";
 * import { afterEach } from "vitest";
 *
 * afterEach(() => {
 *   cleanup();
 * });
 * @since 1.0.0
 */
export function cleanup(): void {
  const errors: unknown[] = [];
  for (const run of Array.from(teardowns).reverse()) {
    try {
      run();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Several test cleanups failed.");
}
