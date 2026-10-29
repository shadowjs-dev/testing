import { createRoot, flushSync, useSignal } from "@shadow-js/core";
import { register } from "./registry";

/**
 * Options of {@link renderDirective}.
 * @see renderDirective
 * @since 1.0.0
 */
export interface RenderDirectiveOptions<A> {
  /** The directive's argument before the test changes it. Its type fixes the type of `setArg`. */
  readonly initialValue: A;
  /**
   * The element the directive is applied to. A tag name creates an element of that tag and appends
   * it to the body; an element is used as it is. Only an element created here is removed on dispose.
   * @default "div" (a new `div` appended to the body)
   */
  readonly targetElement?: HTMLElement | keyof HTMLElementTagNameMap;
}

/**
 * What {@link renderDirective} returns: the element, the argument, and the teardown.
 * @see renderDirective
 * @since 1.0.0
 */
export interface RenderDirectiveResult<A> {
  /** The element the directive was applied to. */
  readonly element: HTMLElement;
  /** Reads the current argument. Call it inside an effect to see the changes it receives. */
  arg(): A;
  /** Changes the argument and flushes the effects it causes before returning. */
  setArg(value: A): void;
  /**
   * Disposes the directive's root, and removes the element when this function created it. Safe to
   * call more than once.
   */
  dispose(): void;
}

/**
 * Applies a directive (`use:name={arg}`) to an element in a root, with an argument the test can
 * change. The directive receives the element and an accessor for the argument, as in JSX; the
 * teardown is registered with {@link cleanup}.
 *
 * @param directive The directive: called once with the element and the argument accessor.
 * @param options The initial argument and the target element.
 * @returns The element, the argument accessor, `setArg` and `dispose`.
 * @example
 * import { renderDirective } from "@shadow-js/testing/dom";
 * import { useEffect } from "@shadow-js/core";
 * import { expect, it } from "vitest";
 *
 * it("follows the argument", () => {
 *   const { element, setArg } = renderDirective(
 *     (el, label) => {
 *       useEffect(() => {
 *         el.title = label();
 *       });
 *     },
 *     { initialValue: "Save" },
 *   );
 *   setArg("Saved");
 *   expect(element.title).toBe("Saved");
 * });
 * @see RenderDirectiveResult
 * @since 1.0.0
 */
export function renderDirective<A>(
  directive: (element: HTMLElement, accessor: () => A) => void,
  options: RenderDirectiveOptions<A>,
): RenderDirectiveResult<A> {
  const target = options.targetElement;
  const element =
    target instanceof HTMLElement
      ? target
      : document.body.appendChild(document.createElement(target ?? "div"));
  const owned = !(target instanceof HTMLElement);
  const [arg, setArg] = useSignal<A>(options.initialValue);
  let made: () => void;
  try {
    made = createRoot((dispose) => {
      directive(element, arg);
      return dispose;
    });
  } catch (error) {
    // createRoot already disposed the root; the element this call appended is ours to remove.
    if (owned) element.remove();
    throw error;
  }
  // Registered before the first flush: an effect that throws there must not leave a live root.
  const dispose = register(() => {
    made();
    if (owned) element.remove();
  });
  try {
    flushSync();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    element,
    arg,
    setArg(value: A): void {
      setArg(() => value);
      flushSync();
    },
    dispose,
  };
}
