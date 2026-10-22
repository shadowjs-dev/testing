/**
 * A promise with its resolve and reject functions exposed, so a test can settle it at the moment it
 * chooses. Returned by {@link deferred}.
 * @see deferred
 * @since 1.0.0
 */
export interface Deferred<T> {
  /** The promise the code under test awaits. It stays pending until `resolve` or `reject` runs. */
  readonly promise: Promise<T>;
  /**
   * Resolves the promise with a value. A promise passed in is adopted, so the result follows it.
   * Only the first settle call has an effect.
   */
  resolve(value: T | PromiseLike<T>): void;
  /**
   * Rejects the promise with a reason. Only the first settle call has an effect. Without a reason the
   * promise rejects with `undefined`.
   */
  reject(reason?: unknown): void;
}

/**
 * Creates a promise that a test settles by hand, for code that awaits data the test does not
 * control. Settle it after the code under test has started waiting on it.
 *
 * @returns The promise, with `resolve` and `reject` to settle it.
 * @example
 * import { deferred } from "@shadow-js/testing";
 * import { expect } from "vitest";
 *
 * const pending = deferred<string>();
 * const shout = pending.promise.then((name) => name.toUpperCase());
 * pending.resolve("ada");
 * await expect(shout).resolves.toBe("ADA");
 * @see mockResource
 * @since 1.0.0
 */
export function deferred<T>(): Deferred<T> {
  // Placeholders are replaced synchronously by the executor, which runs before this returns.
  let settleResolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let settleReject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settleResolve = resolve;
    settleReject = reject;
  });
  return {
    promise,
    resolve: (value) => settleResolve(value),
    reject: (reason) => settleReject(reason),
  };
}

/**
 * A controllable fake for an async data source, such as the fetcher a component passes to
 * `useResource`. Returned by {@link mockResource}.
 * @see mockResource
 * @since 1.0.0
 */
export interface MockResource<T> {
  /**
   * The fetcher to pass to code under test. Each call records a request that stays pending until
   * the test settles it with `resolve` or `reject`.
   */
  readonly fetch: () => Promise<T>;
  /** How many times `fetch` has been called, settled or not. Starts at 0. */
  readonly calls: number;
  /** How many requests are still waiting to be settled. Starts at 0. */
  readonly pending: number;
  /**
   * Settles the oldest pending request with a value. Requests settle in the order they were made.
   * @throws {Error} When no request is pending.
   */
  resolve(value: T): void;
  /**
   * Settles the oldest pending request with a reason, which the caller sees as a rejection. Without a
   * reason it rejects with `undefined`.
   * @throws {Error} When no request is pending.
   */
  reject(reason?: unknown): void;
}

/**
 * Creates a controllable fetcher. Requests settle in the order they were made, so a test decides
 * exactly when each response arrives and can check the state in between.
 *
 * @returns The fetcher, its counters, and the settle functions.
 * @example
 * import { mockResource } from "@shadow-js/testing";
 * import { expect, it } from "vitest";
 *
 * it("waits for the first response", async () => {
 *   const request = mockResource<string>();
 *   const first = request.fetch();
 *   expect(request.pending).toBe(1);
 *   request.resolve("Ada");
 *   await expect(first).resolves.toBe("Ada");
 * });
 * @see deferred
 * @since 1.0.0
 */
export function mockResource<T>(): MockResource<T> {
  const queue: Deferred<T>[] = [];
  let calls = 0;
  const takeOldest = (): Deferred<T> => {
    const next = queue.shift();
    if (next === undefined) throw new Error("mockResource(): no pending request to settle.");
    return next;
  };
  return {
    fetch: (): Promise<T> => {
      calls += 1;
      const request = deferred<T>();
      queue.push(request);
      return request.promise;
    },
    get calls(): number {
      return calls;
    },
    get pending(): number {
      return queue.length;
    },
    resolve: (value) => {
      takeOldest().resolve(value);
    },
    reject: (reason) => {
      takeOldest().reject(reason);
    },
  };
}
