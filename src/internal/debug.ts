/**
 * Testing Library's debugging helpers. They only read the DOM, so they need no flushing.
 * @packageDocumentation
 */
import { prettyDOM as dtlPrettyDOM, getRoles, queryAllByRole } from "@testing-library/dom";

/**
 * The indented markup of an element, for a failing assertion or a `console.log` while writing a
 * test. It returns text, so a test can print it or assert on it.
 *
 * @param element The element to print. Default: `document.body`.
 * @param maxLength The longest output to return, in characters; longer output ends with `...`.
 * Default: 7000, or the `DEBUG_PRINT_LIMIT` environment variable when it is set.
 * @returns The markup as indented text.
 * @example
 * import { prettyDOM } from "@shadow-js/testing/dom";
 *
 * const button = document.createElement("button");
 * button.textContent = "Save";
 * console.log(prettyDOM(button));
 * @since 1.0.0
 */
export function prettyDOM(element?: Element, maxLength?: number): string {
  const target = element ?? document.body;
  const text = dtlPrettyDOM(target, maxLength);
  return typeof text === "string" ? text : "";
}

/**
 * The roles in a container and the accessible names of the elements that have each role, as
 * text: one line per role (`button: Save, Cancel`). Unlike Testing Library's `logRoles`, it returns
 * the text, so a test can assert on it or print it.
 *
 * @param container The element to list. Default: `document.body`.
 * @returns The listing, one line per role, in document order. An element with no name is listed as
 * `(no name)`.
 * @example
 * import { logRoles } from "@shadow-js/testing/dom";
 * import { expect, it } from "vitest";
 *
 * it("lists the buttons by name", () => {
 *   const save = document.createElement("button");
 *   save.textContent = "Save";
 *   document.body.append(save);
 *   expect(logRoles()).toContain("button: Save");
 * });
 * @see prettyDOM
 * @since 1.0.0
 */
export function logRoles(container?: HTMLElement): string {
  const root = container ?? document.body;
  const lines: string[] = [];
  for (const [role, nodes] of Object.entries(getRoles(root))) {
    const names: string[] = [];
    queryAllByRole(root, role, {
      hidden: true,
      name: (value: string, node: Element) => {
        if (nodes.some((candidate) => candidate === node)) {
          names.push(value === "" ? "(no name)" : value);
        }
        return true;
      },
    });
    lines.push(`${role}: ${names.join(", ")}`);
  }
  return lines.join("\n");
}
