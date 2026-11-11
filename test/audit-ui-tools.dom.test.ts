import { afterEach, describe, expect, it } from "vitest";
import "../src/matchers";
import { userEvent } from "../src/dom";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe("[TST-A1] toHaveValue on a multiple select reads the live option state", () => {
  it("[TST-A1.1] sees an option selected or unselected by script, and one chosen by userEvent", () => {
    const root = mount(
      "<select multiple><option value='a'>A</option><option value='b'>B</option><option value='c' selected>C</option></select>",
    );
    const select = root.querySelector("select") as HTMLSelectElement;
    const options = Array.from(select.options);
    (options[0] as HTMLOptionElement).selected = true;
    (options[2] as HTMLOptionElement).selected = false;
    expect(select).toHaveValue(["a"]);
    userEvent.selectOptions(select, ["b"]);
    expect(select).toHaveValue(["a", "b"]);
  });
});

describe("[TST-A2] userEvent.type honors maxlength like a browser", () => {
  it("[TST-A2.1] drops the characters past maxlength and fires no input event for them", () => {
    const root = mount("<input maxlength='3'>");
    const input = root.querySelector("input") as HTMLInputElement;
    let inputs = 0;
    input.addEventListener("input", () => {
      inputs += 1;
    });
    userEvent.type(input, "abcdef");
    expect(input.value).toBe("abc");
    expect(inputs).toBe(3);
  });

  it("[TST-A2.2] keyboard() stops at maxlength as well", () => {
    const root = mount("<textarea maxlength='2'></textarea>");
    const field = root.querySelector("textarea") as HTMLTextAreaElement;
    field.focus();
    userEvent.keyboard("xyz");
    expect(field.value).toBe("xy");
  });
});

describe("[TST-A3] Enter in a text field submits its form like a browser", () => {
  it("[TST-A3.1] clicks the default submit button, which fires click then submit", () => {
    const root = mount(
      "<form><input id='a'><input id='b'><button type='submit'>Go</button></form>",
    );
    const form = root.querySelector("form") as HTMLFormElement;
    const seen: string[] = [];
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      seen.push("submit");
    });
    form.querySelector("button")?.addEventListener("click", () => seen.push("click"));
    (root.querySelector("#a") as HTMLInputElement).focus();
    userEvent.keyboard("{Enter}");
    expect(seen).toEqual(["click", "submit"]);
  });

  it("[TST-A3.2] submits a form with a single text field and no button", () => {
    const root = mount("<form><input id='a'></form>");
    const form = root.querySelector("form") as HTMLFormElement;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });
    (root.querySelector("#a") as HTMLInputElement).focus();
    userEvent.keyboard("{Enter}");
    expect(submits).toBe(1);
  });

  it("[TST-A3.3] does nothing with two fields and no button, with a disabled default button, or when keydown is canceled", () => {
    const root = mount(
      "<form id='f1'><input id='a'><input id='b'></form><form id='f2'><input id='c'><button disabled>Go</button></form><form id='f3'><input id='d'></form>",
    );
    let submits = 0;
    for (const form of root.querySelectorAll("form")) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        submits += 1;
      });
    }
    (root.querySelector("#d") as HTMLInputElement).addEventListener("keydown", (event) =>
      event.preventDefault(),
    );
    for (const id of ["#a", "#c", "#d"]) {
      (root.querySelector(id) as HTMLInputElement).focus();
      userEvent.keyboard("{Enter}");
    }
    expect(submits).toBe(0);
  });
});

describe("[TST-A4] typing into a number input", () => {
  it("[TST-A4.1] typing -5 and 1.5 yields the numbers a user would get", () => {
    const root = mount("<input type='number' id='a'><input type='number' id='b'>");
    const a = root.querySelector("#a") as HTMLInputElement;
    const b = root.querySelector("#b") as HTMLInputElement;
    userEvent.type(a, "-5");
    userEvent.type(b, "1.5");
    expect([a.value, b.value]).toEqual(["-5", "1.5"]);
  });
});

describe("[TST-A5] Tab skips what a browser cannot focus", () => {
  function tabOrder(html: string, steps: number): string[] {
    const root = mount(html);
    (root.querySelector("#a") as HTMLElement).focus();
    const seen: string[] = [];
    for (let step = 0; step < steps; step += 1) {
      userEvent.tab();
      seen.push(document.activeElement?.id ?? "?");
    }
    return seen;
  }

  it("[TST-A5.1] an element with the hidden attribute, or inside a hidden or inert ancestor, is skipped", () => {
    expect(
      tabOrder(
        "<button id='a'>a</button><button id='b' hidden>b</button><div hidden><button id='c'>c</button></div><div inert><button id='d'>d</button></div><button id='e'>e</button>",
        2,
      ),
    ).toEqual(["e", "a"]);
  });

  it("[TST-A5.2] elements with display none are skipped", () => {
    expect(
      tabOrder(
        "<button id='a'>a</button><button id='b' style='display:none'>b</button><button id='c'>c</button>",
        1,
      ),
    ).toEqual(["c"]);
  });
});

describe("[TST-A6] userEvent fires beforeinput before an edit and honors its cancelation", () => {
  it("[TST-A6.1] type: beforeinput precedes input, and a canceled one inserts nothing", () => {
    const root = mount("<input>");
    const input = root.querySelector("input") as HTMLInputElement;
    const seen: string[] = [];
    input.addEventListener("beforeinput", (event) => {
      const data = (event as InputEvent).data;
      seen.push(`before:${data}`);
      if (data === "x") event.preventDefault();
    });
    input.addEventListener("input", (event) => seen.push(`input:${(event as InputEvent).data}`));
    userEvent.type(input, "axb");
    expect(input.value).toBe("ab");
    expect(seen).toEqual(["before:a", "input:a", "before:x", "before:b", "input:b"]);
  });

  it("[TST-A6.2] keyboard Backspace on an empty field fires neither event; on text it fires both", () => {
    const root = mount("<input value='a'>");
    const input = root.querySelector("input") as HTMLInputElement;
    const seen: string[] = [];
    input.addEventListener("beforeinput", () => seen.push("before"));
    input.addEventListener("input", () => seen.push("input"));
    input.focus();
    userEvent.keyboard("{Backspace}{Backspace}");
    expect(input.value).toBe("");
    expect(seen).toEqual(["before", "input"]);
  });

  it("[TST-A6.3] clear: a canceled beforeinput keeps the text", () => {
    const root = mount("<input value='keep'>");
    const input = root.querySelector("input") as HTMLInputElement;
    input.addEventListener("beforeinput", (event) => event.preventDefault());
    userEvent.clear(input);
    expect(input.value).toBe("keep");
  });
});

describe("[TST-A7] toHaveStyle compares values the way a browser's computed style does", () => {
  it("[TST-A7.1] a color matches in any notation, and 0 matches 0px, with any case", () => {
    const root = mount(
      "<div id='a' style='color: #ff0000; margin: 0 auto; display: FLEX; background: url(Img.png)'></div>",
    );
    const element = root.querySelector("#a") as HTMLElement;
    expect(element).toHaveStyle("color: rgb(255, 0, 0)");
    expect(element).toHaveStyle("color: red");
    expect(element).toHaveStyle("color: #F00");
    expect(element).toHaveStyle("margin: 0px auto");
    expect(element).toHaveStyle("display: flex");
    expect(element).toHaveStyle({ color: "rgb(255,0,0)" });
    expect(element).not.toHaveStyle("color: blue");
    expect(element).not.toHaveStyle("margin: 1px auto");
    expect(element).not.toHaveStyle("background: url(img.png)");
  });
});

describe("[TST-A8] keyboard activation and line breaks follow the browser", () => {
  it("[TST-A8.1] Enter in a textarea inserts a line break (beforeinput and input fire with insertLineBreak)", () => {
    const root = mount("<textarea></textarea>");
    const field = root.querySelector("textarea") as HTMLTextAreaElement;
    const types: string[] = [];
    field.addEventListener("input", (event) => types.push((event as InputEvent).inputType));
    field.focus();
    userEvent.keyboard("a{Enter}b");
    expect(field.value).toBe("a\nb");
    expect(types).toEqual(["insertText", "insertLineBreak", "insertText"]);
  });

  it("[TST-A8.2] Enter does not break the line of a read-only textarea, nor of a single-line input", () => {
    const root = mount("<textarea readonly>x</textarea><input value='y'>");
    for (const field of root.querySelectorAll<HTMLElement>("textarea, input")) {
      field.focus();
      userEvent.keyboard("{Enter}");
    }
    expect((root.querySelector("textarea") as HTMLTextAreaElement).value).toBe("x");
    expect((root.querySelector("input") as HTMLInputElement).value).toBe("y");
  });

  it("[TST-A8.3] Space toggles a focused checkbox and selects a focused radio; Enter and Space open a summary", () => {
    const root = mount(
      "<input type='checkbox' id='c'><input type='radio' name='r' id='r1'><input type='radio' name='r' id='r2' checked><details><summary id='s'>s</summary>x</details><input type='checkbox' id='d' disabled>",
    );
    const checkbox = root.querySelector("#c") as HTMLInputElement;
    checkbox.focus();
    userEvent.keyboard("{Space}");
    expect(checkbox.checked).toBe(true);
    userEvent.keyboard("{Space}");
    expect(checkbox.checked).toBe(false);
    (root.querySelector("#r1") as HTMLInputElement).focus();
    userEvent.keyboard("{Space}");
    expect((root.querySelector("#r1") as HTMLInputElement).checked).toBe(true);
    expect((root.querySelector("#r2") as HTMLInputElement).checked).toBe(false);
    const details = root.querySelector("details") as HTMLDetailsElement;
    (root.querySelector("#s") as HTMLElement).focus();
    userEvent.keyboard("{Enter}");
    expect(details.open).toBe(true);
    userEvent.keyboard("{Space}");
    expect(details.open).toBe(false);
    const disabled = root.querySelector("#d") as HTMLInputElement;
    disabled.focus();
    userEvent.keyboard("{Space}");
    expect(disabled.checked).toBe(false);
  });
});
