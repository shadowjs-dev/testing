import { flushSync } from "@shadow-js/core";
import { waitFor as dtlWaitFor, type waitForOptions } from "@testing-library/dom";

/**
 * Testing Library's `waitFor`, except that every queued effect is flushed before each poll. A
 * callback therefore sees the DOM as the signals left it, not a frame behind. Use it to wait for an
 * asynchronous change, such as a resource that resolves after a click.
 *
 * @param callback Polled until it stops throwing. If it returns a promise, the poll waits for it.
 * @param options Timeout, polling interval and MutationObserver settings, as in Testing Library.
 * Defaults: a 1000 ms timeout and a 50 ms interval.
 * @returns The first value the callback returned without throwing.
 * @throws The last error the callback threw, when the time limit passes first.
 * @example
 * import { waitFor } from "@shadow-js/testing/dom";
 * import { expect, it } from "vitest";
 *
 * it("shows the name once it loads", async () => {
 *   await waitFor(() => expect(document.body.textContent).toContain("Ada"));
 * });
 * @see flush
 * @since 1.0.0
 */
export function waitFor<T>(callback: () => T | Promise<T>, options?: waitForOptions): Promise<T> {
  return dtlWaitFor(() => {
    flushSync();
    return callback();
  }, options);
}
