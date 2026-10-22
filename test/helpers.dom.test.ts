import { onCleanup, useSignal } from "@shadow-js/core";
import { describe, expect, it, vi } from "vitest";
import * as dom from "../src/dom";
import * as root from "../src/index";
import { captureWarnings, cleanup, createTestRoot, deferred, flush } from "../src/index";
import { load } from "./support/load";

describe("flush()", () => {
  it("[TST-65] applies a pending signal write, which is not visible before the flush", async () => {
    const [label, setLabel] = useSignal("before");
    const view = dom.render(() => label);
    setLabel("after");
    expect(view.container.textContent).toBe("before");
    await flush();
    expect(view.container.textContent).toBe("after");
  });

  it("[TST-66] waits for queued microtasks before it resolves", async () => {
    const order: string[] = [];
    queueMicrotask(() => order.push("microtask"));
    await flush();
    order.push("after");
    expect(order).toEqual(["microtask", "after"]);
  });
});

describe("createTestRoot()", () => {
  it("[TST-67] runs setup inside an owner and returns its value", () => {
    const made = createTestRoot(() => 5);
    expect(made.value).toBe(5);
    made.dispose();
  });

  it("[TST-68] dispose() runs the owner's cleanups once, and a second dispose is harmless", () => {
    const onDispose = vi.fn();
    const made = createTestRoot(() => {
      onCleanup(onDispose);
      return null;
    });
    made.dispose();
    expect(() => made.dispose()).not.toThrow();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("[TST-69] cleanup() disposes roots that were never disposed by hand", () => {
    const onDispose = vi.fn();
    createTestRoot(() => {
      onCleanup(onDispose);
      return null;
    });
    cleanup();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});

describe("captureWarnings()", () => {
  it("[TST-70] collects core dev warnings and restores console.warn afterward", () => {
    const before = console.warn;
    const captured = captureWarnings(() => {
      onCleanup(() => undefined);
      return "value";
    });
    expect(captured.value).toBe("value");
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]).toContain("onCleanup()");
    expect(console.warn).toBe(before);
  });

  it("[TST-71] restores console.warn even when the captured function throws", () => {
    const before = console.warn;
    const boom = new Error("boom");
    expect(() =>
      captureWarnings(() => {
        throw boom;
      }),
    ).toThrow(boom);
    expect(console.warn).toBe(before);
  });

  it("[TST-72] collects a web dev warning, such as a blocked javascript: URL", async () => {
    const mod = await load<{ link: (url: () => string) => () => unknown }>(
      `export const link = (url) => () => <a href={url()}>go</a>;`,
    );
    const captured = captureWarnings(() => dom.render(mod.link(() => "javascript:alert(1)")));
    expect(captured.messages.some((message) => message.includes("Blocked a script URL"))).toBe(
      true,
    );
    expect(captured.value.container.querySelector("a")?.hasAttribute("href")).toBe(false);
  });

  it("[TST-73] a warning code is reported once per module, so a repeat capture is empty", () => {
    captureWarnings(() => onCleanup(() => undefined));
    const again = captureWarnings(() => onCleanup(() => undefined));
    expect(again.messages).toEqual([]);
  });
});

describe("deferred()", () => {
  it("[TST-74] resolves its promise with the value passed to resolve()", async () => {
    const pending = deferred<number>();
    pending.resolve(4);
    await expect(pending.promise).resolves.toBe(4);
  });

  it("[TST-75] adopts a promise passed to resolve()", async () => {
    const pending = deferred<number>();
    pending.resolve(Promise.resolve(9));
    await expect(pending.promise).resolves.toBe(9);
  });

  it("[TST-76] reject() rejects the promise", async () => {
    const pending = deferred<number>();
    const failure = expect(pending.promise).rejects.toThrow("no");
    pending.reject(new Error("no"));
    await failure;
  });
});

describe("entry points", () => {
  it("[TST-77] the dom entry re-exports the DOM-agnostic helpers unchanged", () => {
    expect(dom.flush).toBe(root.flush);
    expect(dom.createTestRoot).toBe(root.createTestRoot);
    expect(dom.renderHook).toBe(root.renderHook);
    expect(dom.captureWarnings).toBe(root.captureWarnings);
    expect(dom.deferred).toBe(root.deferred);
    expect(dom.mockResource).toBe(root.mockResource);
    expect(dom.cleanup).toBe(root.cleanup);
  });
});
