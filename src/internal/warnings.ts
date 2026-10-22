/**
 * What {@link captureWarnings} returns: the value of the captured function and the warnings it made.
 * @see captureWarnings
 * @since 1.0.0
 */
export interface CapturedWarnings<T> {
  /** What the captured function returned. */
  readonly value: T;
  /** One entry per `console.warn` call: each argument converted with `String` and joined with spaces. */
  readonly messages: readonly string[];
}

/**
 * Runs `fn` and collects every `console.warn` it makes. Core and web report their development
 * warnings through `console.warn`, so a test uses this to assert them. Core sends a warning to its
 * warning listener instead when one is set (`setWarningListener`). `console.warn` is restored in a
 * `finally`, so an exception from `fn` does not leave it replaced.
 *
 * Core reports each warning code once until its dedupe state is reset, so a code already reported
 * earlier in the same test file is not reported again. Assert a warning in the first test that
 * triggers it.
 *
 * @param fn Synchronous code to run. Work that continues after `fn` returns is not captured.
 * @returns The return value of `fn` and the collected messages.
 * @example
 * import { captureWarnings } from "@shadow-js/testing";
 * import { expect, it } from "vitest";
 *
 * it("collects console warnings", () => {
 *   const { value, messages } = captureWarnings(() => {
 *     console.warn("[shadow]", "careful");
 *     return 1;
 *   });
 *   expect(value).toBe(1);
 *   expect(messages).toEqual(["[shadow] careful"]);
 * });
 * @since 1.0.0
 */
export function captureWarnings<T>(fn: () => T): CapturedWarnings<T> {
  const messages: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]): void => {
    messages.push(args.map(String).join(" "));
  };
  try {
    const value = fn();
    return { value, messages: [...messages] };
  } finally {
    console.warn = original;
  }
}
