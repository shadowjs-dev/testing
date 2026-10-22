import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, userEvent } from "../src/dom";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("screen", () => {
  it("[TST-60] queries the whole document body, including content outside the render container", async () => {
    const mod = await load<{ App: () => unknown }>(
      "export const App = () => <button>inside</button>;",
    );
    render(mod.App);
    const outside = document.createElement("p");
    outside.textContent = "outside";
    document.body.append(outside);
    expect(screen.getByRole("button", { name: "inside" })).toBeTruthy();
    expect(screen.getByText("outside")).toBe(outside);
    expect(typeof screen.findByText).toBe("function");
  });

  it("[TST-61] screen follows a replaced body", () => {
    document.body.innerHTML = "<p>one</p>";
    expect(screen.getByText("one")).toBeTruthy();
    document.body.innerHTML = "<p>two</p>";
    expect(screen.queryByText("one")).toBeNull();
    expect(screen.getByText("two")).toBeTruthy();
  });
});

describe("userEvent.keyboard", () => {
  const source = `
    import { useSignal } from "@shadow-js/core";
    export function Search() {
      const [q, setQ] = useSignal("");
      const [keys, setKeys] = useSignal("");
      return (
        <div>
          <input aria-label="q" value={q()} onInput={(e) => setQ(e.currentTarget.value)}
            onKeyDown={(e) => setKeys(keys() + (e.shiftKey ? "S" : "") + e.key + ",")} />
          <output>{q()}|{keys()}</output>
        </div>
      );
    }`;

  it("[TST-62] types characters and named keys into the focused field", async () => {
    const mod = await load<{ Search: () => unknown }>(source);
    const view = render(mod.Search);
    const input = view.getByLabelText<HTMLInputElement>("q");
    input.focus();
    userEvent.keyboard("ab{Backspace}c{Enter}");
    expect(input.value).toBe("ac");
    expect(view.container.querySelector("output")?.textContent).toBe("ac|a,b,Backspace,c,Enter,");
  });

  it("[TST-63] a held modifier applies to the keys after it until it is released", async () => {
    const mod = await load<{ Search: () => unknown }>(source);
    const view = render(mod.Search);
    const input = view.getByLabelText<HTMLInputElement>("q");
    input.focus();
    userEvent.keyboard("{Shift}a{/Shift}b");
    expect(view.container.querySelector("output")?.textContent).toContain("Sa");
    expect(view.container.querySelector("output")?.textContent).toContain(",b,");
    expect(view.container.querySelector("output")?.textContent).not.toContain("Sb");
  });

  it("[TST-64] literal braces, unknown keys and unclosed braces", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    userEvent.keyboard("a{{b[[");
    expect(input.value).toBe("a{b[");
    expect(() => userEvent.keyboard("{Nope}")).toThrow(SyntaxError);
    expect(() => userEvent.keyboard("{Enter")).toThrow(SyntaxError);
    expect(() => userEvent.keyboard("{/Enter}")).toThrow(SyntaxError);
  });

  it("[TST-65] Enter and Space on a focused button click it; Tab moves focus", () => {
    document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>';
    const [a, b] = Array.from(document.querySelectorAll("button"));
    let clicks = 0;
    a?.addEventListener("click", () => {
      clicks += 1;
    });
    a?.focus();
    userEvent.keyboard("{Enter}{Space}");
    expect(clicks).toBe(2);
    userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(b);
  });
});

describe("userEvent pointer and select helpers", () => {
  it("[TST-66] hover and unhover send enter/leave events", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const seen: string[] = [];
    for (const name of [
      "mouseenter",
      "mouseleave",
      "pointerenter",
      "pointerleave",
      "mouseover",
      "mouseout",
    ]) {
      el.addEventListener(name, () => seen.push(name));
    }
    userEvent.hover(el);
    userEvent.unhover(el);
    expect(seen).toEqual(
      ["pointerenter", "mouseover", "mouseenter", "mouseout", "pointerleave", "mouseleave"].sort(
        (x, y) => seen.indexOf(x) - seen.indexOf(y),
      ),
    );
    expect(seen).toContain("mouseenter");
    expect(seen).toContain("mouseleave");
  });

  it("[TST-67] dblClick sends click, click and dblclick", () => {
    const el = document.createElement("button");
    document.body.append(el);
    const seen: string[] = [];
    el.addEventListener("click", () => seen.push("click"));
    el.addEventListener("dblclick", () => seen.push("dblclick"));
    userEvent.dblClick(el);
    expect(seen).toEqual(["click", "click", "dblclick"]);
  });

  it("[TST-68] selectOptions selects by value or text and fires change", () => {
    document.body.innerHTML =
      '<select><option value="a">Alpha</option><option value="b">Beta</option></select>';
    const select = document.querySelector("select") as HTMLSelectElement;
    const changes: string[] = [];
    select.addEventListener("change", () => changes.push(select.value));
    userEvent.selectOptions(select, "Beta");
    expect(select.value).toBe("b");
    userEvent.selectOptions(select, "a");
    expect(changes).toEqual(["b", "a"]);
    expect(() => userEvent.selectOptions(select, "zzz")).toThrow(/no option/);
    expect(() => userEvent.selectOptions(document.body, "a")).toThrow(TypeError);
  });

  it("[TST-69] setup() returns the same userEvent", () => {
    expect(userEvent.setup()).toBe(userEvent);
  });
});

describe("pointer, testEffect, renderDirective, renderHook, render hydrate", () => {
  it("[TST-70] pointer taps with touch and clicks with the mouse, and respects disabled", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const seen: string[] = [];
    for (const name of ["pointerdown", "pointerup", "click", "mousedown", "contextmenu"]) {
      button.addEventListener(name, (event) =>
        seen.push(`${name}:${(event as PointerEvent).pointerType ?? ""}`),
      );
    }
    userEvent.pointer([{ target: button, keys: "[TouchA]" }]);
    expect(seen).toEqual(["pointerdown:touch", "pointerup:touch", "click:touch"]);
    seen.length = 0;
    userEvent.pointer([{ target: button, keys: "[MouseLeft>]" }, { keys: "[/MouseLeft]" }]);
    expect(seen).toEqual(["pointerdown:mouse", "mousedown:", "pointerup:mouse", "click:mouse"]);
    seen.length = 0;
    userEvent.pointer({ target: button, keys: "[MouseRight]" });
    expect(seen.at(-1)).toBe("contextmenu:mouse");
    button.setAttribute("disabled", "");
    seen.length = 0;
    userEvent.pointer({ target: button, keys: "[MouseLeft]" });
    expect(seen).toEqual([]);
    expect(() => userEvent.pointer({ target: button, keys: "[Nope]" })).toThrow(SyntaxError);
  });

  it("[TST-71] pointer without any target throws", () => {
    expect(() => userEvent.pointer({ keys: "[MouseLeft]" })).toThrow(/no target/);
  });

  it("[TST-72] testEffect resolves when done() is called by an effect that ran twice", async () => {
    const { useEffect, useSignal } = await import("@shadow-js/core");
    const { testEffect } = await import("../src/dom");
    const [value, setValue] = useSignal(0);
    await testEffect((done) =>
      useEffect(() => {
        if (value() === 0) setValue(1);
        else done();
      }),
    );
    expect(value()).toBe(1);
  });

  it("[TST-73] testEffect rejects on a throw in setup and on timeout", async () => {
    const { testEffect } = await import("../src/dom");
    await expect(
      testEffect(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(testEffect(() => undefined, { timeoutMs: 20 })).rejects.toThrow(/not called/);
  });

  it("[TST-74] renderDirective drives a directive with a changing argument", async () => {
    const { useEffect } = await import("@shadow-js/core");
    const { renderDirective } = await import("../src/dom");
    const calls: boolean[] = [];
    const { setArg, element } = renderDirective<boolean>(
      (_el, active) => {
        useEffect(() => {
          calls.push(active());
        });
      },
      { initialValue: false },
    );
    setArg(true);
    expect(calls).toEqual([false, true]);
    expect(element.isConnected).toBe(true);
    cleanup();
    expect(element.isConnected).toBe(false);
  });

  it("[TST-75] renderHook returns the owner and a cleanup alias", async () => {
    const { renderHook } = await import("../src/dom");
    const { useSignal, runWithOwner, onCleanup } = await import("@shadow-js/core");
    const log: string[] = [];
    const { owner, cleanup: stop } = renderHook(() => useSignal(0));
    runWithOwner(owner, () => {
      onCleanup(() => log.push("cleaned"));
    });
    stop();
    expect(log).toEqual(["cleaned"]);
  });

  it("[TST-76] render({ hydrate }) adopts server markup instead of rendering new nodes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = '<p data-hk="0-0-0">hello</p>';
    const original = container.querySelector("p");
    const mod = await load<{ App: () => unknown }>("export const App = () => <p>hello</p>;");
    const { createComponent } = await import("@shadow-js/web");
    render(() => createComponent(mod.App, {}), { container, hydrate: true });
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")).toBe(original);
    expect(() => render(mod.App, { hydrate: true })).toThrow(/container/);
  });
});

describe("userEvent.click events", () => {
  it("[TST-77] click dispatches real pointer events carrying the pointer type, then mouse events and click", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const seen: string[] = [];
    for (const name of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      button.addEventListener(name, (event) => {
        seen.push(name);
        if (name.startsWith("pointer")) expect((event as PointerEvent).pointerType).toBe("mouse");
      });
    }
    userEvent.click(button);
    expect(seen).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
  });
});
