import { flushSync, useSignal } from "@shadow-js/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "../src/dom";
import { flush } from "../src/index";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const counterSource = `
import { useSignal } from "@shadow-js/core";
export function Counter() {
  const [count, setCount] = useSignal(0);
  return <button onClick={() => setCount(count() + 1)}>count {count()}</button>;
}`;

describe("reactive updates after events", () => {
  it("[TST-13] a click writes a signal and the button text updates before fireEvent returns", async () => {
    const mod = await load<{ Counter: () => unknown }>(counterSource);
    const view = render(mod.Counter);
    const button = view.getByRole("button", { name: "count 0" });
    fireEvent.click(button);
    expect(button.textContent).toBe("count 1");
    fireEvent.click(view.getByRole("button", { name: "count 1" }));
    expect(view.getByRole("button", { name: "count 2" })).toBe(button);
  });

  it("[TST-14] an input event carries the new value into a signal the paragraph reads", async () => {
    const mod = await load<{ Echo: () => unknown }>(
      `import { useSignal } from "@shadow-js/core";
       export function Echo() {
         const [text, setText] = useSignal("");
         return (
           <div>
             <input aria-label="text" value={text()} onInput={(e) => setText(e.currentTarget.value)} />
             <p>{text()}</p>
           </div>
         );
       }`,
    );
    const view = render(mod.Echo);
    fireEvent.input(view.getByLabelText("text"), { target: { value: "hi" } });
    expect(view.container.querySelector("p")?.textContent).toBe("hi");
  });

  it("[TST-15] a conditional region appears and disappears on successive clicks", async () => {
    const mod = await load<{ Toggle: () => unknown }>(
      `import { useSignal } from "@shadow-js/core";
       export function Toggle() {
         const [open, setOpen] = useSignal(false);
         return (
           <div>
             <button onClick={() => setOpen(!open())}>toggle</button>
             {open() ? <p>details</p> : null}
           </div>
         );
       }`,
    );
    const view = render(mod.Toggle);
    const toggle = view.getByRole("button", { name: "toggle" });
    expect(view.queryByText("details")).toBeNull();
    fireEvent.click(toggle);
    expect(view.getByText("details").tagName).toBe("P");
    fireEvent.click(toggle);
    expect(view.queryByText("details")).toBeNull();
  });

  it("[TST-16] a list driven by a signal grows after a click, in order", async () => {
    const mod = await load<{ List: () => unknown }>(
      `import { useSignal } from "@shadow-js/core";
       export function List() {
         const [items, setItems] = useSignal(["a"]);
         return (
           <div>
             <button onClick={() => setItems([...items(), "b"])}>add</button>
             <ul>{items().map((item) => <li>{item}</li>)}</ul>
           </div>
         );
       }`,
    );
    const view = render(mod.List);
    fireEvent.click(view.getByRole("button", { name: "add" }));
    expect(view.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["a", "b"]);
  });

  it("[TST-17] effects that read the signal re-run once per event, after the DOM update", async () => {
    const seen: number[] = [];
    const mod = await load<{ Tracker: (props: { log: (n: number) => void }) => unknown }>(
      `import { useEffect, useSignal } from "@shadow-js/core";
       export function Tracker(props) {
         const [n, setN] = useSignal(0);
         useEffect(() => { props.log(n()); });
         return <button onClick={() => setN(n() + 1)}>n</button>;
       }`,
    );
    const view = render(() => mod.Tracker({ log: (value: number) => seen.push(value) }));
    flushSync();
    expect(seen).toEqual([0]);
    fireEvent.click(view.getByRole("button"));
    expect(seen).toEqual([0, 1]);
  });

  it("[TST-18] a child component that receives a signal accessor follows the parent's writes", async () => {
    const mod = await load<{ Parent: () => unknown }>(
      `import { useSignal } from "@shadow-js/core";
       const Shown = (props) => <output>{props.value()}</output>;
       export function Parent() {
         const [count, setCount] = useSignal(0);
         return (
           <div>
             <button onClick={() => setCount(count() + 1)}>inc</button>
             <Shown value={count} />
           </div>
         );
       }`,
    );
    const view = render(mod.Parent);
    const button = view.getByRole("button", { name: "inc" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(view.container.querySelector("output")?.textContent).toBe("2");
  });

  it("[TST-19] writes made outside an event are visible after flush()", async () => {
    const [label, setLabel] = useSignal("a");
    const view = render(() => label);
    setLabel("b");
    await flush();
    expect(view.container.textContent).toBe("b");
  });

  it("[TST-20] a signal the UI does not read causes no DOM change", () => {
    const [, setUnused] = useSignal(0);
    const [shown, setShown] = useSignal("static");
    const view = render(() => shown);
    const before = view.container.firstChild;
    setUnused(1);
    flushSync();
    expect(view.container.firstChild).toBe(before);
    expect(view.container.textContent).toBe("static");
    flushSync(() => setShown("changed"));
    expect(view.container.textContent).toBe("changed");
  });
});
