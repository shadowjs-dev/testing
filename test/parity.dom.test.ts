/**
 * Parity with Testing Library and Solid's testing helpers: `within`, `prettyDOM`, `logRoles`,
 * `waitForElementToBeRemoved`, `findBy*` inside `within`, and `userEvent.setup()`.
 */
import { flushSync, useSignal } from "@shadow-js/core";
import { describe, expect, it } from "vitest";
import {
  logRoles,
  prettyDOM,
  render,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from "../src/dom";

describe("Testing Library parity", () => {
  it("[TST-200] within(element) searches only inside that element", () => {
    const container = document.createElement("div");
    container.innerHTML = `<section id="a"><button>Save</button></section><button>Other</button>`;
    document.body.append(container);
    const section = container.querySelector("#a") as HTMLElement;
    const scoped = within(section);
    expect(scoped.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(scoped.queryByRole("button", { name: "Other" })).toBeNull();
    container.remove();
  });

  it("[TST-201] prettyDOM returns the markup of an element as text", () => {
    const element = document.createElement("p");
    element.textContent = "hello";
    const text = prettyDOM(element) as string;
    expect(text).toContain("<p>");
    expect(text).toContain("hello");
  });

  it("[TST-202] logRoles lists the roles and names found in a container", () => {
    const container = document.createElement("div");
    container.innerHTML = `<button>Save</button><a href="/x">Home</a>`;
    const listing = logRoles(container);
    expect(listing).toContain("button");
    expect(listing).toContain("Save");
    expect(listing).toContain("link");
  });

  it("[TST-203] waitForElementToBeRemoved resolves once the element left the page, and rejects while it stays", async () => {
    const [show, setShow] = useSignal(true);
    const view = render(() => () => (show() ? document.createElement("i") : null));
    const element = view.container.querySelector("i") as HTMLElement;
    const removed = waitForElementToBeRemoved(element, { timeout: 500 });
    setShow(false);
    flushSync();
    await expect(removed).resolves.toBeUndefined();

    const stays = document.createElement("b");
    document.body.append(stays);
    await expect(waitForElementToBeRemoved(stays, { timeout: 20 })).rejects.toThrow(/still in/);
    stays.remove();
  });

  it("[TST-204] userEvent.setup() returns an object that dispatches events like userEvent itself", async () => {
    let clicks = 0;
    const button = document.createElement("button");
    button.textContent = "go";
    button.addEventListener("click", () => {
      clicks += 1;
    });
    document.body.append(button);
    const user = userEvent.setup();
    await user.click(button);
    expect(clicks).toBe(1);
    button.remove();
  });
});
