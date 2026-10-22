import { waitFor } from "./wait-for";

/**
 * What {@link waitForElementToBeRemoved} watches: an element, a list of elements, or a callback that
 * returns either. `null` and `undefined` entries count as removed.
 * @since 1.0.0
 */
export type RemovalTarget =
  | Element
  | null
  | undefined
  | readonly (Element | null | undefined)[]
  | (() => Element | null | undefined | readonly (Element | null | undefined)[]);

/**
 * Options of {@link waitForElementToBeRemoved}. They are the options of `waitFor`.
 * @see waitForElementToBeRemoved
 * @since 1.0.0
 */
export interface WaitForRemovalOptions {
  /**
   * How long to wait, in milliseconds, before the promise rejects.
   * @default 1000
   */
  readonly timeout?: number;
  /**
   * How often the condition is checked while waiting, in milliseconds.
   * @default 50
   */
  readonly interval?: number;
}

/**
 * Resolves once the element (or every element a callback returns) is no longer connected to the
 * document. Use it after an action that removes an element asynchronously, such as dismissing a
 * toast. It polls through {@link waitFor}, so pending effects are flushed while it waits. Unlike
 * Testing Library's version, an element that is already detached resolves at once; the promise
 * rejects only when the target is `null` or `undefined` at the start.
 *
 * @param target The element, or a callback returning it.
 * @param options Time limit and polling interval.
 * @returns A promise that resolves with `undefined`.
 * @throws {Error} When the target is `null` or `undefined` at the start: nothing to wait for.
 * @throws {Error} When an element is still connected after the time limit.
 * @example
 * import { waitForElementToBeRemoved } from "@shadow-js/testing/dom";
 * import { it } from "vitest";
 *
 * it("waits for the toast to go", async () => {
 *   const toast = document.createElement("div");
 *   document.body.append(toast);
 *   queueMicrotask(() => toast.remove());
 *   await waitForElementToBeRemoved(toast);
 * });
 * @see waitFor
 * @since 1.0.0
 */
export async function waitForElementToBeRemoved(
  target: RemovalTarget,
  options: WaitForRemovalOptions = {},
): Promise<void> {
  const initial = typeof target === "function" ? target() : target;
  if (initial === null || initial === undefined) {
    throw new Error("waitForElementToBeRemoved: the element to wait for was already missing");
  }
  await waitFor(
    () => {
      const current = typeof target === "function" ? target() : target;
      const list = (Array.isArray(current) ? current : [current]) as readonly (
        | Element
        | null
        | undefined
      )[];
      const connected = list.filter((element) => element?.isConnected === true);
      if (connected.length > 0) throw new Error("The element(s) given are still in the document.");
    },
    options.interval === undefined
      ? { timeout: options.timeout ?? 1000 }
      : { timeout: options.timeout ?? 1000, interval: options.interval },
  );
}
