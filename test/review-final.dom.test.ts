import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "../src/dom";

afterEach(() => {
  vi.useRealTimers();
});

describe("waitFor on fake timers with an interval or timeout that cannot step", () => {
  it("[TST-REVIEW-FINAL-1] an interval of 0 still moves the fake clock, so a timer-driven change shows", async () => {
    vi.useFakeTimers();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 50);
    await waitFor(() => expect(ready).toBe(true), { interval: 0, timeout: 500 });
    expect(ready).toBe(true);
  }, 5000);

  it("[TST-REVIEW-FINAL-1] a NaN interval or timeout ends instead of polling forever", async () => {
    vi.useFakeTimers();
    await expect(
      waitFor(
        () => {
          throw new Error("never");
        },
        { interval: Number.NaN, timeout: 100 },
      ),
    ).rejects.toThrow(/never/);
    await expect(
      waitFor(
        () => {
          throw new Error("never");
        },
        { timeout: Number.NaN },
      ),
    ).rejects.toThrow(/never/);
  }, 5000);
});
