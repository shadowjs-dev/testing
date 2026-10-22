import { flushSync } from "@shadow-js/core";

/** Microtask turns awaited before the synchronous flush. Enough for chained resource promises. */
const MICROTASK_TURNS = 10;

/**
 * Waits ten microtask turns, which lets chained promise callbacks (such as a resource that resolves
 * after another one), then flushes every queued effect synchronously. Await it after a write made
 * outside an event handler, or after a fake data source settles, before checking the result.
 *
 * @returns A promise that resolves after the effects queued so far have run.
 * @example
 * import { flush } from "@shadow-js/testing";
 * import { useSignal } from "@shadow-js/core";
 * import { expect, it } from "vitest";
 *
 * it("reads the new name after a flush", async () => {
 *   const [name, setName] = useSignal("Ada");
 *   setName("Grace");
 *   await flush();
 *   expect(name()).toBe("Grace");
 * });
 * @see act
 * @since 1.0.0
 */
export async function flush(): Promise<void> {
  for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) {
    await Promise.resolve();
  }
  flushSync();
}
