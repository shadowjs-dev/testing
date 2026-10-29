import { flushSync } from "@shadow-js/core";
import { waitFor as dtlWaitFor, getConfig, type waitForOptions } from "@testing-library/dom";

/** The part of a fake-timers clock that `waitFor` drives. */
interface FakeClock {
  tickAsync(milliseconds: number): Promise<unknown>;
}

/**
 * The clock behind `vi.useFakeTimers()`, if `setTimeout` is faked. Vitest installs `@sinonjs/fake-timers`, which hangs its clock on
 * every function it replaces (`setTimeout.clock`); that is a property of the global itself, so nothing from `vitest` is imported
 * and nothing depends on the `vi` global being exposed. Testing Library looks for the same marker, but only acts on it under
 * `jest`.
 */
function fakeClock(): FakeClock | undefined {
  const clock: unknown = (globalThis.setTimeout as unknown as { clock?: unknown }).clock;
  if (typeof clock !== "object" || clock === null) return undefined;
  const tick: unknown = (clock as { tickAsync?: unknown }).tickAsync;
  return typeof tick === "function" ? (clock as FakeClock) : undefined;
}

/**
 * Polls on a fake clock: nothing real elapses, so each round moves the fake time by one interval instead of waiting for it.
 * Same contract as Testing Library's `waitFor` under Jest's fake timers (the first poll is immediate, `timeout` and `interval`
 * are in fake milliseconds, `onTimeout` decides the error).
 */
async function pollOnFakeClock<T>(
  clock: FakeClock,
  callback: () => T | Promise<T>,
  options: waitForOptions | undefined,
): Promise<T> {
  const timeout = options?.timeout ?? getConfig().asyncUtilTimeout;
  // A step of 0 or NaN would never move the clock, and polling would never end.
  const asked = options?.interval ?? 50;
  const interval = asked > 0 ? asked : 1;
  const container = options?.container ?? document.documentElement;
  let lastError: unknown;
  for (let elapsed = 0; ; elapsed += interval) {
    flushSync();
    try {
      return await callback();
    } catch (error) {
      lastError = error;
    }
    if (!(elapsed < timeout)) break;
    await clock.tickAsync(Math.min(interval, timeout - elapsed));
  }
  const error = lastError instanceof Error ? lastError : new Error("Timed out in waitFor.");
  if (options?.onTimeout !== undefined) throw options.onTimeout(error);
  // The default, as in Testing Library: the message gets a snapshot of the container.
  error.message = getConfig().getElementError(error.message, container).message;
  throw error;
}

/**
 * Testing Library's `waitFor`, except that every queued effect is flushed before each poll. A
 * callback therefore sees the DOM as the signals left it, not a frame behind. Use it to wait for an
 * asynchronous change, such as a resource that resolves after a click.
 *
 * With Vitest's fake timers (`vi.useFakeTimers()`) it does not wait for time to pass: each round advances the fake clock by
 * one `interval`, so timers in the code under test fire and the call ends after `timeout` fake milliseconds at most, as
 * Testing Library does under Jest. A callback that returns a promise is awaited before the next round. The `findBy*` and
 * `findAllBy*` queries, `waitForElementToBeRemoved` and the render-bound queries poll through this function, so they behave the same.
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
  const clock = fakeClock();
  if (clock !== undefined) return pollOnFakeClock(clock, callback, options);
  return dtlWaitFor(() => {
    flushSync();
    return callback();
  }, options);
}
