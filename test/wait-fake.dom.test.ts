import { createRoot, useEffect, useSignal } from "@shadow-js/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, waitForElementToBeRemoved, within } from "../src/dom";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  document.body.replaceChildren();
});

describe("waitFor with Vitest fake timers", () => {
  it("[TST-R2-19] advances the fake clock until a timer-driven change shows", async () => {
    vi.useFakeTimers();
    const [label, setLabel] = useSignal("loading");
    const text = document.body.appendChild(document.createElement("p"));
    createRoot(() => {
      useEffect(() => {
        text.textContent = label();
      });
    });
    setTimeout(() => setLabel("ready"), 300);
    await waitFor(() => expect(text.textContent).toBe("ready"));
    expect(Date.now()).toBeGreaterThanOrEqual(300);
  });

  it("[TST-R2-19] a condition that already holds does not move the clock", async () => {
    vi.useFakeTimers();
    const started = Date.now();
    await waitFor(() => expect(1).toBe(1));
    expect(Date.now()).toBe(started);
  });

  it("[TST-R2-19] polls on the interval option and gives up at the timeout with the callback's last error", async () => {
    vi.useFakeTimers();
    let polls = 0;
    const started = Date.now();
    await expect(
      waitFor(
        () => {
          polls += 1;
          throw new Error(`not yet ${polls}`);
        },
        { timeout: 200, interval: 40 },
      ),
    ).rejects.toThrow(/not yet/);
    // One poll now, then one per interval until the 200 ms are used: 1 + 200 / 40 = 6.
    expect(polls).toBe(6);
    expect(Date.now() - started).toBe(200);
  });

  it("[TST-R2-19] an asynchronous callback is awaited, and onTimeout decides the error", async () => {
    vi.useFakeTimers();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 120);
    const value = await waitFor(async () => {
      await Promise.resolve();
      expect(ready).toBe(true);
      return "found";
    });
    expect(value).toBe("found");
    await expect(
      waitFor(
        () => {
          throw new Error("late");
        },
        { timeout: 100, onTimeout: (error) => new Error(`wrapped: ${error.message}`) },
      ),
    ).rejects.toThrow("wrapped: late");
  });

  it("[TST-R2-19] timers faked without setTimeout are not touched: it still polls on the real clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let tries = 0;
    await waitFor(
      () => {
        tries += 1;
        expect(tries).toBeGreaterThan(1);
      },
      { interval: 5 },
    );
    expect(tries).toBe(2);
  });
});

describe("findBy queries with Vitest fake timers", () => {
  function showLater(parent: HTMLElement, text: string, after: number): void {
    setTimeout(() => {
      const item = document.createElement("p");
      item.textContent = text;
      parent.append(item);
    }, after);
  }

  it("[TST-R3-1] screen.findByText advances the fake clock until the element shows", async () => {
    vi.useFakeTimers();
    showLater(document.body, "Ada", 300);
    const found = await screen.findByText("Ada");
    expect(found.tagName).toBe("P");
    expect(Date.now()).toBeGreaterThanOrEqual(300);
  });

  it("[TST-R3-2] within(el).findAllByText and findByRole resolve on the fake clock", async () => {
    vi.useFakeTimers();
    const host = document.body.appendChild(document.createElement("section"));
    showLater(host, "one", 100);
    const items = await within(host).findAllByText(/one/);
    expect(items).toHaveLength(1);
    const button = document.createElement("button");
    button.textContent = "Save";
    setTimeout(() => host.append(button), 400);
    expect(await within(host).findByRole("button", { name: "Save" })).toBe(button);
  });

  it("[TST-R3-3] a render-bound findBy* resolves on the fake clock", async () => {
    vi.useFakeTimers();
    const view = render(() => "start");
    showLater(view.container, "later", 250);
    expect((await view.findByText("later")).textContent).toBe("later");
    expect(Date.now()).toBeGreaterThanOrEqual(250);
  });

  it("[TST-R3-4] a missing element rejects after the fake timeout with the query's own error", async () => {
    vi.useFakeTimers();
    const started = Date.now();
    await expect(
      screen.findByText("never", undefined, { timeout: 200, interval: 40 }),
    ).rejects.toThrow(/Unable to find an element with the text: never/);
    expect(Date.now() - started).toBe(200);
    await expect(
      screen.findAllByTestId("nope", undefined, {
        timeout: 100,
        onTimeout: (error) => new Error(`wrapped: ${error.message.split("\n")[0]}`),
      }),
    ).rejects.toThrow(/^wrapped: Unable to find an element by: \[data-testid="nope"\]/);
  });

  it("[TST-R3-5] a container in the wait options picks the DOM snapshot of the error, as in Testing Library", async () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML("beforeend", "<b>body-only-marker</b>");
    const box = document.body.appendChild(document.createElement("div"));
    box.innerHTML = "<i>box-marker</i>";
    const failure = await screen
      .findByText("absent", undefined, { timeout: 50, container: box })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    // The query's own message lists the body; the snapshot added by the timeout is the container's.
    const snapshot = message.slice(message.lastIndexOf("Ignored nodes"));
    expect(snapshot).toContain("box-marker");
    expect(snapshot).not.toContain("body-only-marker");
  });

  it("[TST-R3-7] the timeout error reads the same on the fake clock and on the real one", async () => {
    document.body.replaceChildren();
    document.body.insertAdjacentHTML("beforeend", "<p>only</p>");
    const real = await screen
      .findByText("absent", undefined, { timeout: 30, interval: 10 })
      .catch((error: unknown) => error);
    vi.useFakeTimers();
    const fake = await screen
      .findByText("absent", undefined, { timeout: 30, interval: 10 })
      .catch((error: unknown) => error);
    expect((fake as Error).message).toBe((real as Error).message);
    expect((fake as Error).name).toBe((real as Error).name);
  });

  it("[TST-R3-6] with real timers a findBy* still resolves when the element shows later", async () => {
    showLater(document.body, "real", 20);
    expect((await screen.findByText("real")).textContent).toBe("real");
  });

  it("[TST-R3-8] waitForElementToBeRemoved resolves on the fake clock", async () => {
    vi.useFakeTimers();
    const toast = document.body.appendChild(document.createElement("div"));
    setTimeout(() => toast.remove(), 500);
    await waitForElementToBeRemoved(toast, { timeout: 2000 });
    expect(Date.now()).toBeGreaterThanOrEqual(500);
  });
});
