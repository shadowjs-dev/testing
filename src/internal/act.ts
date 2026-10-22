import { flushSync } from "@shadow-js/core";

/**
 * Runs `callback` and flushes the effects it caused before returning, so a test can read the
 * result of a write right away. Use it around writes made outside an event handler, the way React
 * tests use `act`. A synchronous callback is flushed before this returns. An asynchronous callback
 * is awaited, and the effects it scheduled are flushed after it resolves; a rejected promise is
 * passed on without that second flush.
 *
 * @param callback The work to run. Its return value (or promise) is returned.
 * @returns The callback's value, or a promise of it when the callback is asynchronous.
 * @throws The error the callback throws, after the effects it caused have flushed.
 * @example
 * import { act } from "@shadow-js/testing";
 * import { useSignal } from "@shadow-js/core";
 * import { expect } from "vitest";
 *
 * const [count, setCount] = useSignal(0);
 * act(() => setCount(1));
 * expect(count()).toBe(1);
 * @see flush
 * @since 1.0.0
 */
export function act<T>(callback: () => T): T {
  const result = flushSync(callback);
  if (typeof (result as { then?: unknown } | undefined)?.then === "function") {
    const pending = result as unknown as PromiseLike<unknown>;
    return pending.then((value) => {
      flushSync();
      return value;
    }) as unknown as T;
  }
  return result;
}
