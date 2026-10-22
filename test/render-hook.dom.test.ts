import { createContext, flushSync, onCleanup, useContext, useSignal } from "@shadow-js/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "../src/index";

afterEach(() => {
  document.body.replaceChildren();
});

describe("renderHook()", () => {
  it("[TST-32] result.current is the value the hook returned", () => {
    const { result, dispose } = renderHook(() => 42);
    expect(result.current).toBe(42);
    dispose();
  });

  it("[TST-33] the hook runs once inside an owner, so its cleanups run on dispose", () => {
    const onDispose = vi.fn();
    let runs = 0;
    const { dispose } = renderHook(() => {
      runs += 1;
      onCleanup(onDispose);
      return "value";
    });
    expect(runs).toBe(1);
    expect(onDispose).not.toHaveBeenCalled();
    dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("[TST-34] dispose() is idempotent", () => {
    const onDispose = vi.fn();
    const { dispose } = renderHook(() => {
      onCleanup(onDispose);
      return null;
    });
    dispose();
    expect(() => dispose()).not.toThrow();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("[TST-35] a wrapper's context provider is visible to the hook through useContext", () => {
    const Theme = createContext("light");
    const { result, dispose } = renderHook(() => useContext(Theme), {
      wrapper: (props) =>
        Theme({
          value: "dark",
          get children() {
            return props.children;
          },
        }),
    });
    expect(result.current).toBe("dark");
    dispose();
  });

  it("[TST-36] a wrapper that never reads props.children is reported, because the hook would not run", () => {
    expect(() => renderHook(() => 1, { wrapper: () => null })).toThrow(/props\.children/);
  });

  it("[TST-37] a hook can return signal accessors, which keep reading the live value", () => {
    const [count, setCount] = useSignal(1);
    const { result, dispose } = renderHook(() => ({ read: count }));
    flushSync(() => setCount(2));
    expect(result.current.read()).toBe(2);
    dispose();
  });

  it("[TST-38] an error thrown by the hook propagates, and the failed root is not left for cleanup to trip on", () => {
    expect(() =>
      renderHook(() => {
        throw new Error("bad hook");
      }),
    ).toThrow("bad hook");
    expect(() => cleanup()).not.toThrow();
  });
});
