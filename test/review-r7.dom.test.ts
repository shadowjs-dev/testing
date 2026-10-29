import { afterEach, describe, expect, it } from "vitest";
import "../src/matchers";
import { accessibleMatchers, userEvent } from "../src/dom";

expect.extend(accessibleMatchers);

afterEach(() => {
  document.body.replaceChildren();
});

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

/** Counts the input and click events an element receives. */
function watch(element: Element, ...types: string[]): string[] {
  const seen: string[] = [];
  for (const type of types) element.addEventListener(type, () => seen.push(type));
  return seen;
}

describe("[TEST-R7-1] user events do not edit controls a user cannot edit", () => {
  it("[TEST-R7-1.1] type and clear leave a disabled input alone and fire no input event", () => {
    const root = mount("<input id='i' value='keep' disabled>");
    const input = root.querySelector("input") as HTMLInputElement;
    const seen = watch(input, "input", "keydown");
    userEvent.type(input, "abc");
    userEvent.clear(input);
    expect(input.value).toBe("keep");
    expect(seen).toEqual([]);
  });

  it("[TEST-R7-1.2] type and clear leave a readonly input and textarea alone and fire no input event", () => {
    const root = mount("<input id='i' value='keep' readonly><textarea readonly>text</textarea>");
    for (const field of [
      root.querySelector("input") as HTMLInputElement,
      root.querySelector("textarea") as HTMLTextAreaElement,
    ]) {
      const seen = watch(field, "input");
      const before = field.value;
      userEvent.type(field, "abc");
      userEvent.clear(field);
      expect(field.value).toBe(before);
      expect(seen).toEqual([]);
    }
  });

  it("[TEST-R7-1.3] an input inside a disabled fieldset is disabled too", () => {
    const root = mount("<fieldset disabled><input value='keep'></fieldset>");
    const input = root.querySelector("input") as HTMLInputElement;
    userEvent.type(input, "abc");
    expect(input.value).toBe("keep");
  });

  it("[TEST-R7-1.4] keyboard does not edit a readonly field that has focus, and still edits an editable one", () => {
    const root = mount("<input id='ro' value='keep' readonly><input id='rw'>");
    const readonly = root.querySelector("#ro") as HTMLInputElement;
    const editable = root.querySelector("#rw") as HTMLInputElement;
    readonly.focus();
    const seen = watch(readonly, "input");
    userEvent.keyboard("abc{Backspace}");
    expect(readonly.value).toBe("keep");
    expect(seen).toEqual([]);
    editable.focus();
    userEvent.keyboard("ab");
    expect(editable.value).toBe("ab");
  });

  it("[TEST-R7-1.5] keyboard Enter does not click a disabled button", () => {
    const root = mount("<button disabled>go</button>");
    const button = root.querySelector("button") as HTMLButtonElement;
    const seen = watch(button, "click");
    button.focus();
    userEvent.keyboard("{Enter} ");
    expect(seen).toEqual([]);
  });

  it("[TEST-R7-1.6] selectOptions skips a disabled option, and does nothing on a disabled select", () => {
    const root = mount(
      "<select id='a'><option value='x'>x</option><option value='y' disabled>y</option></select>" +
        "<select id='b' disabled><option value='x'>x</option><option value='y'>y</option></select>" +
        "<select id='c'><option value='x'>x</option><optgroup label='g' disabled><option value='z'>z</option></optgroup></select>",
    );
    const [a, b, c] = Array.from(root.querySelectorAll("select"));
    const seenA = watch(a as HTMLSelectElement, "change", "input");
    userEvent.selectOptions(a as HTMLSelectElement, "y");
    expect((a as HTMLSelectElement).value).toBe("x");
    expect(seenA).toEqual([]);
    const seenB = watch(b as HTMLSelectElement, "change", "input");
    userEvent.selectOptions(b as HTMLSelectElement, "y");
    expect((b as HTMLSelectElement).value).toBe("x");
    expect(seenB).toEqual([]);
    userEvent.selectOptions(c as HTMLSelectElement, "z");
    expect((c as HTMLSelectElement).value).toBe("x");
  });

  it("[TEST-R7-1.7] selectOptions still selects an enabled option and fires input and change", () => {
    const root = mount("<select><option value='x'>x</option><option value='y'>y</option></select>");
    const select = root.querySelector("select") as HTMLSelectElement;
    const seen = watch(select, "input", "change");
    userEvent.selectOptions(select, "y");
    expect(select.value).toBe("y");
    expect(seen).toEqual(["input", "change"]);
  });
});

describe("[TEST-R7-2] click and pointer respect a disabled fieldset", () => {
  it("[TEST-R7-2.1] click on a button inside a disabled fieldset fires nothing; inside its first legend it does", () => {
    const root = mount(
      "<fieldset disabled><button id='in'>in</button><legend><button id='leg'>leg</button></legend></fieldset>",
    );
    const inside = root.querySelector("#in") as HTMLElement;
    const legend = root.querySelector("#leg") as HTMLElement;
    const seenInside = watch(inside, "click", "pointerdown", "mousedown");
    const seenLegend = watch(legend, "click");
    userEvent.click(inside);
    userEvent.dblClick(inside);
    expect(seenInside).toEqual([]);
    userEvent.click(legend);
    expect(seenLegend).toEqual(["click"]);
  });

  it("[TEST-R7-2.2] pointer press and release on a control in a disabled fieldset fire nothing", () => {
    const root = mount("<fieldset disabled><button>in</button></fieldset>");
    const button = root.querySelector("button") as HTMLElement;
    const seen = watch(button, "click", "pointerdown", "pointerup", "mousedown", "mouseup");
    userEvent.pointer([{ target: button, keys: "[MouseLeft]" }]);
    userEvent.pointer([{ target: button, keys: "[TouchA]" }]);
    expect(seen).toEqual([]);
  });

  it("[TEST-R7-2.3] a plain element is not disabled by a stray disabled attribute, as in a browser", () => {
    const root = mount("<div disabled id='d'>d</div>");
    const div = root.querySelector("#d") as HTMLElement;
    const seen = watch(div, "click");
    userEvent.click(div);
    expect(seen).toEqual(["click"]);
  });

  it("[TEST-R7-2.4] tab skips a control in a disabled fieldset", () => {
    const root = mount("<fieldset disabled><input id='a'></fieldset><input id='b'>");
    userEvent.tab();
    expect(document.activeElement).toBe(root.querySelector("#b"));
  });
});

describe("[TEST-R7-3] toHaveStyle with a string", () => {
  it("[TEST-R7-3.1] a declaration without a colon throws a TypeError instead of passing vacuously", () => {
    const root = mount("<p style='color: red'>x</p>");
    const p = root.querySelector("p") as HTMLElement;
    expect(() => expect(p).toHaveStyle("color red")).toThrow(TypeError);
    expect(() => expect(p).toHaveStyle("color:")).toThrow(TypeError);
    expect(() => expect(p).toHaveStyle(":red")).toThrow(TypeError);
    expect(() => expect(p).toHaveStyle("")).toThrow(TypeError);
  });

  it("[TEST-R7-3.2] a value that holds a colon or a semicolon is compared whole", () => {
    const root = mount("<p>x</p>");
    const p = root.querySelector("p") as HTMLElement;
    p.style.setProperty("--image", "url(data:image/png;base64,AAA)");
    expect(p).toHaveStyle("--image: url(data:image/png;base64,AAA)");
    expect(() => expect(p).toHaveStyle("--image: url(data:image/png;base64,BBB)")).toThrow();
    // A semicolon inside quotes does not end the declaration (so this is a mismatch, not a malformed declaration).
    expect(() => expect(p).toHaveStyle("--q: 'x;y'")).not.toThrow(TypeError);
  });

  it("[TEST-R7-3.3] several declarations, a trailing semicolon and extra spaces still work", () => {
    const root = mount("<p style='color: red; margin-top: 4px'>x</p>");
    const p = root.querySelector("p") as HTMLElement;
    expect(p).toHaveStyle("margin-top:4px;  ");
    expect(() => expect(p).toHaveStyle("margin-top: 4px; color: blue;")).toThrow();
  });
});

describe("[TEST-R7-4] toBeVisible follows jest-dom", () => {
  it("[TEST-R7-4.1] opacity 0 on the element or an ancestor is not visible", () => {
    const root = mount(
      "<div style='opacity:0'><span id='child'>c</span></div><p id='self' style='opacity:0'>s</p><p id='half' style='opacity:0.5'>h</p>",
    );
    expect(() => expect(root.querySelector("#child")).toBeVisible()).toThrow();
    expect(() => expect(root.querySelector("#self")).toBeVisible()).toThrow();
    expect(root.querySelector("#half")).toBeVisible();
  });

  it("[TEST-R7-4.2] content of a closed details is not visible, except the summary and the details itself", () => {
    const root = mount(
      "<details id='closed'><summary id='sum'><b id='bold'>s</b></summary><p id='body'>b</p></details><details open><summary>s</summary><p id='shown'>b</p></details>",
    );
    expect(root.querySelector("#closed")).toBeVisible();
    expect(root.querySelector("#sum")).toBeVisible();
    expect(root.querySelector("#bold")).toBeVisible();
    expect(() => expect(root.querySelector("#body")).toBeVisible()).toThrow();
    expect(root.querySelector("#shown")).toBeVisible();
  });
});

describe("[TEST-R7-5] toHaveTextContent and regular expressions", () => {
  it("[TEST-R7-5.1] an empty string matches only an element with no text", () => {
    const root = mount("<p id='full'>text</p><p id='empty'></p><p id='space'>  </p>");
    expect(() => expect(root.querySelector("#full")).toHaveTextContent("")).toThrow();
    expect(root.querySelector("#empty")).toHaveTextContent("");
    expect(root.querySelector("#space")).toHaveTextContent("");
  });

  it("[TEST-R7-5.2] a global or sticky regular expression gives the same answer every time", () => {
    const root = mount(
      "<button aria-label='Save' aria-describedby='d'>x</button><p id='d'>Save it</p>",
    );
    const button = root.querySelector("button") as HTMLElement;
    const global = /Save/g;
    for (let round = 0; round < 3; round += 1) {
      expect(button).toHaveTextContent(/x/g);
      expect(button).toHaveAccessibleName(global);
      expect(button).toHaveAccessibleDescription(/Save/gy);
    }
    expect(global.lastIndex).toBe(0);
  });
});
