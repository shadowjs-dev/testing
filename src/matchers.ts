/**
 * `@shadow-js/testing/matchers`: registers the jest-dom style matchers with vitest's `expect`
 * when imported, so `expect(element).toBeInTheDocument()` works in every test file that imports
 * it. Import it once, from a setup file or the test itself.
 *
 * The matcher types are added to vitest's `Matchers` interface, so the assertions type-check.
 *
 * The accessible-name matchers (`toHaveAccessibleName`, `toHaveAccessibleDescription`) need
 * `@testing-library/dom`, so they are in `@shadow-js/testing/dom` (`accessibleMatchers`), not here.
 * @packageDocumentation
 */
import { expect } from "vitest";
import type { ClassOptions, TextContentOptions } from "./internal/matchers";
import { matchers } from "./internal/matchers";

expect.extend(matchers);

/**
 * The DOM matchers that this entry adds to vitest's `expect`. A matcher whose subject is not a DOM
 * node throws a `TypeError` instead of reporting a failure; `toBeInTheDocument` is the exception and
 * fails for `null`. `T` is the type of the value being asserted on (vitest's `Matchers` interface has
 * the same two parameters, which the augmentation below mirrors).
 * @see accessibleMatchers
 * @since 1.0.0
 */
export interface TestingLibraryMatchers<R = unknown, T = unknown> {
  /** The element is connected to the document. A `null` subject fails it. */
  toBeInTheDocument(): R;
  /**
   * The text content contains `expected`, or matches it when it is a pattern.
   * @default `normalizeWhitespace: true`: runs of whitespace collapse, and the ends are trimmed, before the comparison.
   */
  toHaveTextContent(expected: string | RegExp, options?: TextContentOptions): R;
  /**
   * The attribute `name` is present, and equals `String(value)` when `value` is given.
   * @default No value: only the presence of the attribute is checked.
   */
  toHaveAttribute(name: string, value?: unknown): R;
  /**
   * The element is connected and not hidden: no `hidden` attribute, no `display: none`, and no
   * `visibility: hidden` or `collapse`, on it or on an ancestor.
   */
  toBeVisible(): R;
  /** The element is disabled by its `disabled` attribute, or it is inside a disabled `fieldset`. */
  toBeDisabled(): R;
  /** The opposite of `toBeDisabled`. */
  toBeEnabled(): R;
  /**
   * The form value is `expected`: a string, a number for number inputs, or an array for multiple
   * selects.
   * @default No argument: passes when the value is not empty.
   */
  toHaveValue(expected?: T | string | number | string[]): R;
  /** The element is the document's active element. */
  toHaveFocus(): R;
  /**
   * A checkbox or radio is checked, or an element with a checkable role (such as `switch`) has
   * `aria-checked="true"`. Any other element throws a `TypeError`.
   */
  toBeChecked(): R;
  /**
   * The element has every listed class.
   * @default `exact` is `false`: other classes are allowed. With `exact: true` it has no others.
   */
  toHaveClass(...classes: [...string[], ClassOptions] | string[]): R;
  /** The computed style has the given declarations: a CSS string, or an object with camelCase keys. */
  toHaveStyle(style: string | Record<string, string>): R;
  /** The element contains the other element. Throws a `TypeError` when `element` is not an element. */
  toContainElement(element: Element | null): R;
}

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<R, T> {}
}
