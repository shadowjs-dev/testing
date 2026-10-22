import { useEffect, useSignal } from "@shadow-js/core";
import { describe, expect, it } from "vitest";
import { act, createTestRoot } from "../src/index";

describe("act (React testing parity)", () => {
  it("[ACT-T01] a synchronous act applies the writes and runs the effects before it returns", () => {
    const [value, setValue] = useSignal(0);
    let seen = -1;
    const root = createTestRoot(() => {
      useEffect(() => {
        seen = value();
      });
    });
    act(() => setValue(7));
    expect(seen).toBe(7);
    root.dispose();
  });

  it("[ACT-T02] an async act waits for the callback and then flushes what it scheduled", async () => {
    const [value, setValue] = useSignal(0);
    let seen = -1;
    const root = createTestRoot(() => {
      useEffect(() => {
        seen = value();
      });
    });
    await act(async () => {
      await Promise.resolve();
      setValue(3);
    });
    expect(seen).toBe(3);
    root.dispose();
  });

  it("[ACT-T03] act returns the callback's value", () => {
    expect(act(() => 42)).toBe(42);
  });
});
