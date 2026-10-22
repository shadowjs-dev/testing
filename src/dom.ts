/**
 * `@shadow-js/testing/dom`: DOM rendering, Testing Library queries, `fireEvent`, `userEvent` and
 * `waitFor`. Everything in `@shadow-js/testing` is re-exported, so one import is enough.
 * @packageDocumentation
 */
export * from "./index";
export { accessibleMatchers } from "./internal/accessible-matchers";
export { logRoles, prettyDOM } from "./internal/debug";
export {
  type FireEvent,
  type FireInit,
  type FireMethod,
  type FireTarget,
  fireEvent,
} from "./internal/fire-event";
export type { FindQueries, Queries } from "./internal/queries";
export { screen } from "./internal/queries";
export { type RenderOptions, type RenderResult, render } from "./internal/render";
export {
  type RenderDirectiveOptions,
  type RenderDirectiveResult,
  renderDirective,
} from "./internal/render-directive";
export {
  type PointerStep,
  type TabOptions,
  type UserEvent,
  userEvent,
} from "./internal/user-event";
export { waitFor } from "./internal/wait-for";
export {
  type RemovalTarget,
  type WaitForRemovalOptions,
  waitForElementToBeRemoved,
} from "./internal/wait-removed";
export { within } from "./internal/within";

/**
 * The accessible-name matchers that `expect.extend(accessibleMatchers)` adds to vitest's `expect`
 * types. The `declare module "vitest"` block below makes the assertions type-check.
 * @see accessibleMatchers
 * @since 1.0.0
 */
export interface AccessibleMatchers<R = unknown> {
  /**
   * The accessible name equals `expected`, or matches it when it is a pattern. Without an argument,
   * it passes when the element has any non-empty name.
   */
  toHaveAccessibleName(expected?: string | RegExp): R;
  /**
   * The accessible description equals `expected`, or matches it when it is a pattern. Without an
   * argument, it passes when the element has any non-empty description.
   */
  toHaveAccessibleDescription(expected?: string | RegExp): R;
}

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends AccessibleMatchers<R> {}
}
