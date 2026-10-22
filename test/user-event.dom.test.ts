import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, userEvent } from "../src/dom";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const nameFieldSource = `
import { useSignal } from "@shadow-js/core";
export function NameField() {
  const [name, setName] = useSignal("");
  return (
    <form>
      <label>Name <input value={name()} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <p>Hello {name()}</p>
    </form>
  );
}`;

describe("userEvent", () => {
  it("[TST-46] type() updates a controlled input's signal one character at a time", async () => {
    const mod = await load<{ NameField: () => unknown }>(nameFieldSource);
    const view = render(mod.NameField);
    const input = view.getByLabelText<HTMLInputElement>("Name");
    const seen: string[] = [];
    input.addEventListener("input", () => seen.push(input.value));
    userEvent.type(input, "abc");
    expect(input.value).toBe("abc");
    expect(view.container.querySelector("p")?.textContent).toBe("Hello abc");
    expect(seen).toEqual(["a", "ab", "abc"]);
  });

  it("[TST-47] type() appends to the existing value", async () => {
    const mod = await load<{ NameField: () => unknown }>(nameFieldSource);
    const view = render(mod.NameField);
    const input = view.getByLabelText<HTMLInputElement>("Name");
    userEvent.type(input, "hi");
    userEvent.type(input, "!");
    expect(input.value).toBe("hi!");
    expect(view.container.querySelector("p")?.textContent).toBe("Hello hi!");
  });

  it("[TST-48] type() focuses the field before typing", async () => {
    const mod = await load<{ NameField: () => unknown }>(nameFieldSource);
    const view = render(mod.NameField);
    const input = view.getByLabelText<HTMLInputElement>("Name");
    userEvent.type(input, "x");
    expect(document.activeElement).toBe(input);
  });

  it("[TST-49] clear() empties a controlled input and the signal it drives", async () => {
    const mod = await load<{ NameField: () => unknown }>(nameFieldSource);
    const view = render(mod.NameField);
    const input = view.getByLabelText<HTMLInputElement>("Name");
    userEvent.type(input, "abc");
    userEvent.clear(input);
    expect(input.value).toBe("");
    expect(view.container.querySelector("p")?.textContent).toBe("Hello ");
  });

  it("[TST-50] type() on an element that is not a text field throws a TypeError", () => {
    const button = document.createElement("button");
    document.body.append(button);
    expect(() => userEvent.type(button, "x")).toThrow(TypeError);
    expect(() => userEvent.type(button, "x")).toThrow(/input or textarea/);
  });

  it("[TST-51] click() runs the handler once per click and the DOM update is visible immediately", async () => {
    const mod = await load<{ Counter: () => unknown }>(
      `import { useSignal } from "@shadow-js/core";
       export function Counter() {
         const [count, setCount] = useSignal(0);
         return <button onClick={() => setCount(count() + 1)}>count {count()}</button>;
       }`,
    );
    const view = render(mod.Counter);
    const button = view.getByRole("button");
    userEvent.click(button);
    expect(button.textContent).toBe("count 1");
    userEvent.click(button);
    expect(button.textContent).toBe("count 2");
  });

  it("[TST-52] click() on a disabled button does not dispatch click", () => {
    const button = document.createElement("button");
    button.disabled = true;
    document.body.append(button);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("[TST-53] tab() moves focus through focusable elements in document order, skipping disabled ones, and wraps", () => {
    document.body.innerHTML = `
      <input id="a" />
      <button id="b">b</button>
      <a id="c" href="#c">c</a>
      <input id="d" disabled />
      <input id="e" />`;
    const focus = (id: string): void => {
      document.getElementById(id)?.focus();
    };
    focus("a");
    userEvent.tab();
    expect(document.activeElement?.id).toBe("b");
    userEvent.tab();
    expect(document.activeElement?.id).toBe("c");
    userEvent.tab();
    expect(document.activeElement?.id).toBe("e");
    userEvent.tab();
    expect(document.activeElement?.id).toBe("a");
  });

  it("[TST-54] tab({ shift: true }) moves focus backwards", () => {
    document.body.innerHTML = `<input id="a" /><button id="b">b</button>`;
    document.getElementById("b")?.focus();
    userEvent.tab({ shift: true });
    expect(document.activeElement?.id).toBe("a");
  });

  it("[TST-55] tab() with no focusable element leaves focus alone and does not throw", () => {
    document.body.innerHTML = `<p>no controls</p>`;
    expect(() => userEvent.tab()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });
});
