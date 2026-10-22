/**
 * Opt-in setup entry. Importing `@shadow-js/testing/auto-cleanup` from a Vitest setup file (or at
 * the top of a test file) registers `afterEach(cleanup)`, so every render and root is disposed
 * after each test. Importing it is the only side effect; the package is otherwise side-effect free.
 *
 * @example
 * // vitest.setup.ts
 * import "@shadow-js/testing/auto-cleanup";
 * @since 1.0.0
 */
import { afterEach } from "vitest";
import { cleanup } from "./internal/registry";

afterEach(() => {
  cleanup();
});
