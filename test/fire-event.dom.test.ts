import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "../src/dom";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function element(tag: string, attributes: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  document.body.append(node);
  return node;
}

describe("fireEvent", () => {
  it("[TST-39] fireEvent.click dispatches a bubbling click that reaches an ancestor listener", () => {
    const parent = element("div");
    const button = document.createElement("button");
    parent.append(button);
    const seen: boolean[] = [];
    parent.addEventListener("click", (event) => seen.push(event.bubbles));
    fireEvent.click(button);
    expect(seen).toEqual([true]);
  });

  it("[TST-40] fireEvent.input with a target value writes the value before the event is dispatched", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const seen: string[] = [];
    input.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement) seen.push(event.target.value);
    });
    fireEvent.input(input, { target: { value: "typed" } });
    expect(input.value).toBe("typed");
    expect(seen).toEqual(["typed"]);
  });

  it("[TST-41] fireEvent.keyDown passes the init dictionary to the KeyboardEvent", () => {
    const field = element("input");
    const keys: string[] = [];
    field.addEventListener("keydown", (event) => {
      if (event instanceof KeyboardEvent) keys.push(event.key);
    });
    fireEvent.keyDown(field, { key: "Enter", code: "Enter" });
    expect(keys).toEqual(["Enter"]);
  });

  it("[TST-42] the return value is false when a listener calls preventDefault", () => {
    const link = element("button");
    expect(fireEvent.click(link)).toBe(true);
    link.addEventListener("click", (event) => event.preventDefault());
    expect(fireEvent.click(link)).toBe(false);
  });

  it("[TST-43] the call form fireEvent(element, event) dispatches a prepared event", () => {
    const target = element("div");
    const handler = vi.fn();
    target.addEventListener("ping", handler);
    const result = fireEvent(target, new Event("ping"));
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("[TST-44] fireEvent.change sets a select's value and notifies listeners", () => {
    const select = document.createElement("select");
    document.body.append(select);
    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    const seen: string[] = [];
    select.addEventListener("change", (event) => {
      if (event.target instanceof HTMLSelectElement) seen.push(event.target.value);
    });
    fireEvent.change(select, { target: { value: "b" } });
    expect(select.value).toBe("b");
    expect(seen).toEqual(["b"]);
  });

  it("[TST-45] fireEvent.dblClick dispatches an event whose type is dblclick", () => {
    const button = element("button");
    const types: string[] = [];
    button.addEventListener("dblclick", (event) => types.push(event.type));
    fireEvent.dblClick(button);
    expect(types).toEqual(["dblclick"]);
  });
});
