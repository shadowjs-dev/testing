import { bindQueries, type Queries } from "./queries";

/**
 * Binds the Testing Library queries (`getByRole`, `findByText` and the rest) to one element, so they
 * search inside it only. Use it when a test needs one part of a page, such as a dialog, that is
 * already in the DOM and was not rendered by {@link render}.
 *
 * @param element The element the queries search inside.
 * @returns The bound queries. The `find*` queries flush effects while they wait.
 * @example
 * import { within } from "@shadow-js/testing/dom";
 * import { expect, it } from "vitest";
 *
 * it("finds the save button inside the dialog", () => {
 *   const dialog = document.createElement("div");
 *   dialog.setAttribute("role", "dialog");
 *   dialog.innerHTML = "<button>Save</button>";
 *   document.body.append(dialog);
 *   expect(within(dialog).getByRole("button", { name: "Save" })).toBeTruthy();
 * });
 * @see render
 * @since 1.0.0
 */
export function within(element: HTMLElement): Queries {
  return bindQueries(element);
}
