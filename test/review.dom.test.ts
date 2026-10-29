import { onCleanup, useEffect } from "@shadow-js/core";
import { afterEach, describe, expect, it } from "vitest";
import "../src/matchers";
import { cleanup, render, renderDirective, userEvent } from "../src/dom";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("cleanup after a throwing mount", () => {
  it("[TST-REV-1] render() with hydrate and no container throws without appending a container", () => {
    expect(() => render(() => "x", { hydrate: true })).toThrow(TypeError);
    expect(document.body.children.length).toBe(0);
  });

  it("[TST-REV-2] render() removes the container it appended when the UI throws", () => {
    expect(() =>
      render(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(document.body.children.length).toBe(0);
  });

  it("[TST-REV-3] render() leaves a container the caller supplied in place when the UI throws", () => {
    const container = document.body.appendChild(document.createElement("section"));
    expect(() =>
      render(
        () => {
          throw new Error("boom");
        },
        { container },
      ),
    ).toThrow("boom");
    expect(container.isConnected).toBe(true);
  });

  it("[TST-REV-4] renderDirective() removes its element when the directive throws", () => {
    expect(() =>
      renderDirective(
        () => {
          throw new Error("boom");
        },
        { initialValue: 1 },
      ),
    ).toThrow("boom");
    expect(document.body.children.length).toBe(0);
  });

  it("[TST-REV-5] renderDirective() disposes the root and removes the element when a first effect throws", () => {
    let cleaned = false;
    expect(() =>
      renderDirective(
        () => {
          onCleanup(() => {
            cleaned = true;
          });
          useEffect(() => {
            throw new Error("boom");
          });
        },
        { initialValue: 1 },
      ),
    ).toThrow("boom");
    expect(document.body.children.length).toBe(0);
    expect(cleaned).toBe(true);
  });
});

describe("userEvent.keyboard Tab", () => {
  it("[TST-REV-6] {Tab} dispatches one keydown, and the keyup reaches the newly focused element", () => {
    document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>';
    const [a, b] = Array.from(document.querySelectorAll("button"));
    const seen: string[] = [];
    for (const [name, el] of [
      ["a", a],
      ["b", b],
    ] as const) {
      el?.addEventListener("keydown", () => seen.push(`${name}:down`));
      el?.addEventListener("keyup", () => seen.push(`${name}:up`));
    }
    a?.focus();
    userEvent.keyboard("{Tab}");
    expect(seen).toEqual(["a:down", "b:up"]);
    expect(document.activeElement).toBe(b);
  });
});

describe("matchers", () => {
  it("[TST-REV-7] toBeDisabled applies to form controls only, and spares the first legend of a disabled fieldset", () => {
    document.body.innerHTML =
      "<fieldset disabled><legend><input id='legend-input'></legend><div id='plain'>x</div><input id='inside'></fieldset>";
    expect(document.querySelector("#inside")).toBeDisabled();
    expect(document.querySelector("#legend-input")).toBeEnabled();
    expect(document.querySelector("#plain")).toBeEnabled();
  });
});
