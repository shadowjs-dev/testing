import { getOwner, type Owner } from "@shadow-js/core";
import { createTestRoot } from "./test-root";

/**
 * Options of {@link renderHook}. Every member is optional.
 * @see renderHook
 * @since 1.0.0
 */
export interface RenderHookOptions {
  /**
   * Wraps the hook, typically to provide a context. The wrapper must read `props.children` (a getter)
   * for the hook to run, for example `Theme({ value, get children() { return props.children; } })`.
   * @default No wrapper: the hook runs directly inside the root.
   */
  readonly wrapper?: (props: { children: unknown }) => unknown;
}

/**
 * What {@link renderHook} returns: the hook's value, its owner, and the teardown.
 * @see renderHook
 * @since 1.0.0
 */
export interface RenderHookResult<T> {
  /** Holds the hook's return value in `current`. Reactive values are accessors: call them to read updates. */
  readonly result: { readonly current: T };
  /** Disposes the hook's root and runs its cleanups. Safe to call more than once. */
  dispose(): void;
  /** The same as `dispose()`, under the name Testing Library users expect. */
  cleanup(): void;
  /** The hook's owner: pass it to `runWithOwner` to create more reactive state inside it. */
  readonly owner: Owner;
}

/**
 * Calls `hook` once inside an owner, so the effects and cleanups it creates belong to that owner
 * and a test can read and write its reactive values. Nothing re-runs the hook: the signals it
 * returns keep their identity, and the test reads them through their accessors.
 *
 * @param hook The hook to run. It is called exactly once.
 * @param options An optional `wrapper` that provides context around the hook.
 * @returns `result.current` holds the hook's return value; `dispose()` tears it down.
 * @throws {Error} When the wrapper never reads `props.children`, so the hook never ran.
 * @example
 * import { renderHook } from "@shadow-js/testing";
 * import { useSignal } from "@shadow-js/core";
 * import { expect, it } from "vitest";
 *
 * it("counts", () => {
 *   const { result, dispose } = renderHook(() => useSignal(1));
 *   const [count, setCount] = result.current;
 *   setCount(2);
 *   expect(count()).toBe(2);
 *   dispose();
 * });
 * @see cleanup
 * @since 1.0.0
 */
export function renderHook<T>(hook: () => T, options: RenderHookOptions = {}): RenderHookResult<T> {
  // A holder object: assignments inside the closures are not seen by control-flow narrowing.
  const slot: { captured?: { readonly value: T }; owner?: Owner } = {};
  const capture = (): null => {
    if (slot.captured === undefined) {
      const owner = getOwner();
      if (owner !== null) slot.owner = owner;
      slot.captured = { value: hook() };
    }
    return null;
  };
  const wrapper = options.wrapper;
  const root = createTestRoot(() => {
    if (wrapper === undefined) capture();
    else
      wrapper({
        get children() {
          return capture();
        },
      });
  });
  const captured = slot.captured;
  const owner = slot.owner;
  if (captured === undefined || owner === undefined) {
    root.dispose();
    throw new Error(
      "renderHook(): the wrapper did not read props.children, so the hook never ran.",
    );
  }
  return {
    result: {
      get current(): T {
        return captured.value;
      },
    },
    dispose: root.dispose,
    cleanup: root.dispose,
    owner,
  };
}
