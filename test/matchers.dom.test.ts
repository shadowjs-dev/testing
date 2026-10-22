/**
 * jest-dom style matchers from `@shadow-js/testing/matchers`. Each matcher has a passing and a
 * failing case; a failing case is checked with `expect(() => ...).toThrow()`.
 */
import { describe, expect, it } from "vitest";
import "../src/matchers";
import { accessibleMatchers } from "../src/dom";

// The accessible-name matchers need @testing-library/dom, so they come from the `dom` entry.
expect.extend(accessibleMatchers);

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe("jest-dom matchers", () => {
  it("[TST-210] toBeInTheDocument passes for a connected element and fails for a detached one", () => {
    const root = mount("<p id='x'>x</p>");
    expect(root.querySelector("#x")).toBeInTheDocument();
    expect(() => expect(document.createElement("p")).toBeInTheDocument()).toThrow();
    root.remove();
  });

  it("[TST-211] toHaveTextContent matches a substring, a regular expression, and normalizes whitespace on request", () => {
    const root = mount("<p id='t'>  Hello   world </p>");
    const element = root.querySelector("#t") as HTMLElement;
    expect(element).toHaveTextContent("Hello");
    expect(element).toHaveTextContent(/world$/);
    expect(element).toHaveTextContent("Hello world", { normalizeWhitespace: true });
    expect(() => expect(element).toHaveTextContent("Bye")).toThrow();
    root.remove();
  });

  it("[TST-212] toHaveAttribute checks presence and value", () => {
    const root = mount("<a id='l' href='/home' data-x='1'>l</a>");
    const link = root.querySelector("#l") as HTMLElement;
    expect(link).toHaveAttribute("href");
    expect(link).toHaveAttribute("href", "/home");
    expect(() => expect(link).toHaveAttribute("title")).toThrow();
    expect(() => expect(link).toHaveAttribute("href", "/other")).toThrow();
    root.remove();
  });

  it("[TST-213] toBeVisible fails for display none, visibility hidden and hidden attributes on an ancestor", () => {
    const root = mount(
      "<div id='shown'>s</div><div style='display:none'><span id='gone'>g</span></div><div hidden><span id='hidden'>h</span></div><div style='visibility:hidden'><span id='invisible'>i</span></div>",
    );
    expect(root.querySelector("#shown")).toBeVisible();
    expect(() => expect(root.querySelector("#gone")).toBeVisible()).toThrow();
    expect(() => expect(root.querySelector("#hidden")).toBeVisible()).toThrow();
    expect(() => expect(root.querySelector("#invisible")).toBeVisible()).toThrow();
    root.remove();
  });

  it("[TST-214] toBeDisabled and toBeEnabled follow the disabled attribute and a disabled fieldset", () => {
    const root = mount(
      "<button id='off' disabled>o</button><fieldset disabled><input id='inside'></fieldset><button id='on'>n</button>",
    );
    expect(root.querySelector("#off")).toBeDisabled();
    expect(root.querySelector("#inside")).toBeDisabled();
    expect(root.querySelector("#on")).toBeEnabled();
    expect(() => expect(root.querySelector("#on")).toBeDisabled()).toThrow();
    root.remove();
  });

  it("[TST-215] toHaveValue reads inputs, textareas, selects and multiple selects", () => {
    const root = mount(
      "<input id='i' value='abc'><textarea id='t'>txt</textarea><select id='s'><option value='a'>a</option><option value='b' selected>b</option></select><select id='m' multiple><option value='x' selected>x</option><option value='y' selected>y</option></select><input id='n' type='number' value='4'>",
    );
    expect(root.querySelector("#i")).toHaveValue("abc");
    expect(root.querySelector("#t")).toHaveValue("txt");
    expect(root.querySelector("#s")).toHaveValue("b");
    expect(root.querySelector("#m")).toHaveValue(["x", "y"]);
    expect(root.querySelector("#n")).toHaveValue(4);
    expect(() => expect(root.querySelector("#i")).toHaveValue("zzz")).toThrow();
    root.remove();
  });

  it("[TST-216] toHaveFocus compares with the active element", () => {
    const root = mount("<input id='f'><input id='g'>");
    const input = root.querySelector("#f") as HTMLInputElement;
    input.focus();
    expect(input).toHaveFocus();
    expect(root.querySelector("#g")).not.toHaveFocus();
    root.remove();
  });

  it("[TST-217] toHaveAccessibleName and toHaveAccessibleDescription use the accessible name and description", () => {
    const root = mount(
      "<button id='b' aria-label='Save draft' aria-describedby='d'>icon</button><p id='d'>Stores the draft</p>",
    );
    const button = root.querySelector("#b") as HTMLElement;
    expect(button).toHaveAccessibleName("Save draft");
    expect(button).toHaveAccessibleName(/draft/);
    expect(button).toHaveAccessibleDescription("Stores the draft");
    expect(() => expect(button).toHaveAccessibleName("Publish")).toThrow();
    root.remove();
  });

  it("[TST-218] toBeChecked reads checkboxes, radios and aria-checked", () => {
    const root = mount(
      "<input id='c' type='checkbox' checked><input id='r' type='radio'><div id='a' role='switch' aria-checked='true'></div>",
    );
    expect(root.querySelector("#c")).toBeChecked();
    expect(root.querySelector("#r")).not.toBeChecked();
    expect(root.querySelector("#a")).toBeChecked();
    expect(() => expect(root.querySelector("#r")).toBeChecked()).toThrow();
    root.remove();
  });

  it("[TST-219] toHaveClass checks the listed classes; exact requires the same set", () => {
    const root = mount("<p id='p' class='a b'></p>");
    const element = root.querySelector("#p") as HTMLElement;
    expect(element).toHaveClass("a");
    expect(element).toHaveClass("a", "b");
    expect(element).toHaveClass("b", "a", { exact: true });
    expect(() => expect(element).toHaveClass("a", { exact: true })).toThrow();
    root.remove();
  });

  it("[TST-220] toHaveStyle compares computed styles, given as a string or an object", () => {
    const root = mount("<p id='s' style='color: rgb(255, 0, 0); margin-top: 4px'></p>");
    const element = root.querySelector("#s") as HTMLElement;
    expect(element).toHaveStyle("margin-top: 4px");
    expect(element).toHaveStyle({ color: "rgb(255, 0, 0)" });
    expect(() => expect(element).toHaveStyle({ color: "blue" })).toThrow();
    root.remove();
  });

  it("[TST-221] toContainElement is true for a descendant and false for a sibling", () => {
    const root = mount("<section id='s'><p id='inner'></p></section><p id='out'></p>");
    const section = root.querySelector("#s") as HTMLElement;
    expect(section).toContainElement(root.querySelector("#inner"));
    expect(section).not.toContainElement(root.querySelector("#out"));
    root.remove();
  });

  it("[TST-222] a matcher given something that is not an element says so", () => {
    expect(() => expect("not an element").toBeInTheDocument()).toThrow(/expected an element/);
  });
});
