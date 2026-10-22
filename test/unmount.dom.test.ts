import { flushSync, useSignal } from "@shadow-js/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "../src/dom";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("unmount() and cleanup()", () => {
  it("[TST-21] unmount() removes the rendered nodes from the container", () => {
    const paragraph = document.createElement("p");
    const view = render(() => paragraph);
    expect(view.container.contains(paragraph)).toBe(true);
    view.unmount();
    expect(paragraph.isConnected).toBe(false);
    expect(view.container.childNodes.length).toBe(0);
  });

  it("[TST-22] unmount() removes the container that render() created", () => {
    const view = render(() => "gone");
    expect(document.body.contains(view.container)).toBe(true);
    view.unmount();
    expect(document.body.contains(view.container)).toBe(false);
  });

  it("[TST-23] unmount() runs the owner's cleanups exactly once", async () => {
    const mod = await load<{ Timer: (props: { onDispose: () => void }) => unknown }>(
      `import { onCleanup } from "@shadow-js/core";
       export function Timer(props) {
         onCleanup(() => props.onDispose());
         return <p>timer</p>;
       }`,
    );
    const onDispose = vi.fn();
    const view = render(() => mod.Timer({ onDispose }));
    expect(onDispose).not.toHaveBeenCalled();
    view.unmount();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("[TST-24] after unmount, signal writes do not reach the DOM and do not throw", () => {
    const [value, setValue] = useSignal("first");
    const view = render(() => value);
    view.unmount();
    expect(() => {
      flushSync(() => setValue("second"));
    }).not.toThrow();
    expect(view.container.textContent).toBe("");
  });

  it("[TST-25] a second unmount() is a no-op: cleanups do not run again", async () => {
    const mod = await load<{ Timer: (props: { onDispose: () => void }) => unknown }>(
      `import { onCleanup } from "@shadow-js/core";
       export function Timer(props) {
         onCleanup(() => props.onDispose());
         return <p>timer</p>;
       }`,
    );
    const onDispose = vi.fn();
    const view = render(() => mod.Timer({ onDispose }));
    view.unmount();
    expect(() => view.unmount()).not.toThrow();
    cleanup();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("[TST-26] cleanup() unmounts every render made since the last cleanup, and is idempotent", () => {
    render(() => "one");
    render(() => "two");
    expect(document.body.childElementCount).toBe(2);
    cleanup();
    expect(document.body.childElementCount).toBe(0);
    expect(() => cleanup()).not.toThrow();
  });

  it("[TST-27] cleanup() runs the teardowns of the most recent renders first", async () => {
    const mod = await load<{ Timer: (props: { name: string; order: string[] }) => unknown }>(
      `import { onCleanup } from "@shadow-js/core";
       export function Timer(props) {
         onCleanup(() => props.order.push(props.name));
         return <p>{props.name}</p>;
       }`,
    );
    const order: string[] = [];
    render(() => mod.Timer({ name: "first", order }));
    render(() => mod.Timer({ name: "second", order }));
    cleanup();
    expect(order).toEqual(["second", "first"]);
  });

  it("[TST-28] unmount() after the container was detached from the document does not throw", () => {
    const paragraph = document.createElement("p");
    const view = render(() => paragraph);
    view.container.remove();
    expect(() => view.unmount()).not.toThrow();
    expect(view.container.childNodes.length).toBe(0);
  });

  it("[TST-29] a user-provided container stays in the document after unmount, empty", () => {
    const host = document.createElement("section");
    document.body.append(host);
    const view = render(() => "content", { container: host });
    view.unmount();
    expect(document.body.contains(host)).toBe(true);
    expect(host.childNodes.length).toBe(0);
  });

  it("[TST-30] cleanup() runs every teardown even when one throws, then rethrows that error", async () => {
    const mod = await load<{
      Breaks: () => unknown;
      Timer: (props: { onDispose: () => void }) => unknown;
    }>(
      `import { onCleanup } from "@shadow-js/core";
       export function Breaks() {
         onCleanup(() => {
           throw new Error("cleanup broke");
         });
         return <p>breaks</p>;
       }
       export function Timer(props) {
         onCleanup(() => props.onDispose());
         return <p>timer</p>;
       }`,
    );
    const onDispose = vi.fn();
    render(() => mod.Timer({ onDispose }));
    render(mod.Breaks);
    expect(() => cleanup()).toThrow("cleanup broke");
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(() => cleanup()).not.toThrow();
  });

  it("[TST-31] cleanup() with nothing mounted is a no-op", () => {
    expect(() => cleanup()).not.toThrow();
    expect(document.body.childElementCount).toBe(0);
  });
});
