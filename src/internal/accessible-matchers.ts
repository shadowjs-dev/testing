/**
 * The accessible-name and accessible-description matchers. They need Testing Library's role
 * computation (`getRoles`, `queryAllByRole`), so they live apart from the DOM-only matchers in
 * `matchers.ts`: only the `dom` entry imports this module, and `@testing-library/dom` is an optional
 * peer of this package.
 * @packageDocumentation
 */
import { getRoles, queryAllByRole } from "@testing-library/dom";
import { type MatcherResult, nodeOf, testPattern } from "./matchers";

/** The accessible name and description of an element, as Testing Library computes them. */
function accessibleFacts(element: Element): { name: string; description: string } | undefined {
  const root = element.ownerDocument.body;
  if (root === null || !root.contains(element)) return undefined;
  const roles = getRoles(root);
  let role: string | undefined;
  for (const [candidate, nodes] of Object.entries(roles)) {
    if (nodes.some((candidate) => candidate === element)) {
      role = candidate;
      break;
    }
  }
  if (role === undefined) return undefined;
  let name = "";
  let description = "";
  // The filters run in order and a later one is only asked about the elements the earlier kept,
  // so both keep everything and only record what they are told about this element.
  queryAllByRole(root, role, {
    hidden: true,
    name: (value: string, node: Element) => {
      if (node === element) name = value;
      return true;
    },
    description: (value: string, node: Element) => {
      if (node === element) description = value;
      return true;
    },
  });
  return { name, description };
}

/**
 * The `toHaveAccessibleName` and `toHaveAccessibleDescription` matchers, computed the way Testing
 * Library computes them. Register them once with `expect.extend`; use them to check what a screen
 * reader would announce, not the markup. An element with no `aria-label` and no text has an empty
 * name.
 *
 * @example
 * import { accessibleMatchers } from "@shadow-js/testing/dom";
 * import { expect, it } from "vitest";
 *
 * expect.extend(accessibleMatchers);
 *
 * it("names the save button", () => {
 *   const button = document.createElement("button");
 *   button.textContent = "Save";
 *   document.body.append(button);
 *   expect(button).toHaveAccessibleName("Save");
 * });
 * @since 1.0.0
 */
export const accessibleMatchers = {
  toHaveAccessibleName(actual: unknown, expected?: string | RegExp): MatcherResult {
    const element = nodeOf(actual, "toHaveAccessibleName");
    const name = accessibleFacts(element)?.name ?? element.getAttribute("aria-label") ?? "";
    const pass =
      expected === undefined
        ? name !== ""
        : typeof expected === "string"
          ? name === expected
          : testPattern(expected, name);
    return {
      pass,
      message: () =>
        `expected the accessible name ${pass ? "not " : ""}to be ${String(expected ?? "(any)")}; it is "${name}"`,
    };
  },

  toHaveAccessibleDescription(actual: unknown, expected?: string | RegExp): MatcherResult {
    const element = nodeOf(actual, "toHaveAccessibleDescription");
    const description = accessibleFacts(element)?.description ?? "";
    const pass =
      expected === undefined
        ? description !== ""
        : typeof expected === "string"
          ? description === expected
          : testPattern(expected, description);
    return {
      pass,
      message: () =>
        `expected the accessible description ${pass ? "not " : ""}to be ${String(expected ?? "(any)")}; it is "${description}"`,
    };
  },
} as const;
