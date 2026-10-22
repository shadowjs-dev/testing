import { createRoot, flushSync } from "@shadow-js/core";

/**
 * Options of {@link testEffect}. Every member is optional.
 * @see testEffect
 * @since 1.0.0
 */
export interface TestEffectOptions {
  /**
   * How long `done` may take to be called, in milliseconds. After that the promise rejects with an
   * `Error` and the root is disposed.
   * @default 5000
   */
  readonly timeoutMs?: number;
}

/**
 * Runs `setup` in a root and resolves when it calls `done()`. Use it to test an effect that must run
 * more than once, for example one that writes a signal and then checks the result on the next run.
 * The promise rejects with whatever `setup` throws, or with an `Error` when `done` is not called in
 * time. The root is disposed in every case.
 *
 * @param setup Receives `done`. Create the state and effects here; call `done()` once the test's
 * condition holds.
 * @param options The time limit.
 * @returns A promise that resolves when `done()` is called.
 * @throws {Error} When `done()` is not called within `timeoutMs`.
 * @example
 * import { testEffect } from "@shadow-js/testing";
 * import { useEffect, useSignal } from "@shadow-js/core";
 * import { it } from "vitest";
 *
 * it("runs the effect twice", async () => {
 *   await testEffect((done) => {
 *     const [count, setCount] = useSignal(0);
 *     useEffect(() => {
 *       if (count() === 0) setCount(1);
 *       else done();
 *     });
 *   });
 * });
 * @see flush
 * @since 1.0.0
 */
export function testEffect(
  setup: (done: () => void) => void,
  options: TestEffectOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000;
  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let stop: (() => void) | undefined;
    const timer = setTimeout(() => {
      finish(new Error(`testEffect(): done() was not called within ${timeoutMs} ms.`));
    }, timeoutMs);
    function finish(error?: unknown): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // Disposal is deferred: `done()` may be called from inside the effect that is running.
      queueMicrotask(() => stop?.());
      if (error === undefined) resolve();
      else reject(error);
    }
    try {
      createRoot((dispose) => {
        stop = dispose;
        setup(() => finish());
      });
      flushSync();
    } catch (error) {
      finish(error);
    }
  });
}
