import { flushSync, useSignal } from "@shadow-js/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "../src/dom";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("render()", () => {
  it("[TST-01] mounts into a new div appended to document.body by default", () => {
    const view = render(() => "hello");
    expect(view.container.parentElement).toBe(document.body);
    expect(view.baseElement).toBe(document.body);
    expect(view.container.textContent).toBe("hello");
  });

  it("[TST-02] getByText finds elements produced by compiled JSX", async () => {
    const mod = await load<{ Greeting: () => unknown }>(
      `export const Greeting = () => <p>Hello <b>Ada</b></p>;`,
    );
    const view = render(mod.Greeting);
    expect(view.getByText("Ada").tagName).toBe("B");
    expect(view.queryByText("Grace")).toBeNull();
  });

  it("[TST-03] getByRole uses real ARIA roles, implicit and explicit", async () => {
    const mod = await load<{ Panel: () => unknown }>(
      `export const Panel = () => (
        <main>
          <h2>Settings</h2>
          <button>Save</button>
          <input type="checkbox" />
          <ul><li>one</li><li>two</li></ul>
        </main>
      );`,
    );
    const view = render(mod.Panel);
    expect(view.getByRole("main").tagName).toBe("MAIN");
    expect(view.getByRole("heading", { name: "Settings" }).tagName).toBe("H2");
    expect(view.getByRole("button", { name: "Save" }).tagName).toBe("BUTTON");
    expect(view.getByRole("checkbox").tagName).toBe("INPUT");
    expect(view.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["one", "two"]);
  });

  it("[TST-04] getByLabelText resolves wrapping labels and aria-label", async () => {
    const mod = await load<{ Form: () => unknown }>(
      `export const Form = () => (
        <form>
          <label>Email <input type="email" /></label>
          <button aria-label="Close">x</button>
        </form>
      );`,
    );
    const view = render(mod.Form);
    expect(view.getByLabelText("Email").tagName).toBe("INPUT");
    expect(view.getByLabelText("Close").tagName).toBe("BUTTON");
  });

  it("[TST-05] options.container renders into the given element, which is also the default baseElement", () => {
    const host = document.createElement("section");
    document.body.append(host);
    const view = render(() => "inside", { container: host });
    expect(view.container).toBe(host);
    expect(view.baseElement).toBe(host);
    expect(host.textContent).toBe("inside");
    expect(view.getByText("inside")).toBe(host);
  });

  it("[TST-06] options.baseElement scopes the queries and hosts a new container", async () => {
    const mod = await load<{ Button: () => unknown }>(
      `export const Button = () => <button>Save</button>;`,
    );
    const base = document.createElement("main");
    document.body.append(base);
    const outside = document.createElement("p");
    outside.textContent = "outside";
    document.body.append(outside);
    const view = render(mod.Button, { baseElement: base });
    expect(view.baseElement).toBe(base);
    expect(view.container.parentElement).toBe(base);
    expect(view.getByRole("button").textContent).toBe("Save");
    expect(view.queryByText("outside")).toBeNull();
  });

  it("[TST-07] options.wrapper renders around the UI, and the UI arrives as props.children", async () => {
    const mod = await load<{ Frame: (props: { children: unknown }) => unknown }>(
      `export const Frame = (props) => <section class="frame">{props.children}</section>;`,
    );
    const view = render(() => "content", { wrapper: mod.Frame });
    expect(view.container.querySelector(".frame")?.textContent).toBe("content");
  });

  it("[TST-08] there is no rerender(): changing props means writing a signal the UI reads", () => {
    const [label, setLabel] = useSignal("first");
    const view = render(() => label);
    expect("rerender" in view).toBe(false);
    flushSync(() => setLabel("second"));
    expect(view.container.textContent).toBe("second");
  });

  it("[TST-09] debug() logs the pretty-printed baseElement", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const paragraph = document.createElement("p");
    paragraph.textContent = "printed";
    const view = render(() => paragraph);
    view.debug();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("printed");
    log.mockRestore();
  });

  it("[TST-10] asFragment() returns a snapshot that does not follow later updates", () => {
    const [count, setCount] = useSignal(1);
    const view = render(() => count);
    const snapshot = view.asFragment();
    flushSync(() => setCount(2));
    expect(snapshot.textContent).toBe("1");
    expect(view.container.textContent).toBe("2");
  });

  it("[TST-11] getBy throws when nothing matches, while queryBy returns null and queryAllBy []", () => {
    const view = render(() => "here");
    expect(() => view.getByText("missing")).toThrow(
      /Unable to find an element with the text: missing/,
    );
    expect(view.queryByText("missing")).toBeNull();
    expect(view.queryAllByRole("button")).toEqual([]);
  });

  it("[TST-12] a second render into the same container appends after the first", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const first = render(() => "a", { container: host });
    render(() => "b", { container: host });
    expect(host.textContent).toBe("ab");
    expect(first.getByText("ab", { selector: "div" })).toBe(host);
  });
});
