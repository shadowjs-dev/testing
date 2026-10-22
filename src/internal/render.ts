import { prettyDOM } from "@testing-library/dom";
import { mountView } from "./mount";
import { bindQueries, type Queries } from "./queries";

/**
 * Options of {@link render}. Every member is optional.
 * @see render
 * @since 1.0.0
 */
export interface RenderOptions {
  /**
   * The element that receives the output.
   * @default A new `div` appended to `baseElement`, removed on unmount.
   */
  readonly container?: HTMLElement;
  /**
   * The element the queries search within.
   * @default `container` when it is given, otherwise `document.body`
   */
  readonly baseElement?: HTMLElement;
  /**
   * Wraps the UI, for example to provide context. The UI is passed as the `children` getter, so
   * `{props.children}` in JSX renders it inside the wrapper's owner.
   * @default No wrapper: the UI is rendered directly.
   */
  readonly wrapper?: (props: { children: unknown }) => unknown;
  /**
   * Adopts the server markup already in `container` instead of rendering new nodes, the way
   * `hydrate()` does. Needs `container`. Pass an object to forward `renderId` and the resource `data`.
   * @default false: render new nodes
   */
  readonly hydrate?:
    | boolean
    | { readonly renderId?: string; readonly data?: Record<string, unknown> };
}

/**
 * What {@link render} returns: every Testing Library query bound to `baseElement`, plus the
 * container, `unmount()`, `debug()` and `asFragment()`.
 *
 * There is no `rerender()`. A ShadowJS component runs once, and its output changes through the
 * signals it reads, so a test changes the UI by writing a signal (with `flushSync` or `flush()`).
 * @since 1.0.0
 */
export type RenderResult = Queries & {
  /** The element the UI was rendered into. */
  readonly container: HTMLElement;
  /** The element the queries are bound to. */
  readonly baseElement: HTMLElement;
  /** Removes the rendered nodes, disposes the owner and runs its cleanups. Safe to call twice. */
  unmount(): void;
  /** Logs the pretty-printed DOM of `element` (default: `baseElement`). */
  debug(element?: Element): void;
  /** A DocumentFragment copy of the container's current content. Later updates do not change it. */
  asFragment(): DocumentFragment;
};

/**
 * Mounts `ui` with the web renderer, flushes its effects, and returns the container together with
 * the bound queries and helpers. Use it to test a component the way a user sees it. The render is
 * unmounted by {@link cleanup}, or by the `@shadow-js/testing/auto-cleanup` entry after each test.
 *
 * @param ui Function returning the output: a component call, a node, text or an array.
 * @param options Container, base element, wrapper and hydration.
 * @returns The render result.
 * @throws {TypeError} When hydration is enabled (`hydrate` is `true` or an object) and no `container`
 * is given, since there is no server markup to adopt.
 * @example
 * import { fireEvent, render } from "@shadow-js/testing/dom";
 * import { useSignal } from "@shadow-js/core";
 * import { expect, it } from "vitest";
 *
 * function Counter() {
 *   const [count, setCount] = useSignal(0);
 *   return <button onClick={() => setCount(count() + 1)}>count {count()}</button>;
 * }
 *
 * it("counts clicks", () => {
 *   const view = render(() => Counter());
 *   fireEvent.click(view.getByRole("button", { name: "count 0" }));
 *   expect(view.getByRole("button", { name: "count 1" })).toBeTruthy();
 * });
 * @see RenderResult
 * @since 1.0.0
 */
export function render(ui: () => unknown, options: RenderOptions = {}): RenderResult {
  const mounted = mountView(ui, options);
  const { container, baseElement, unmount } = mounted;
  return Object.assign(bindQueries(baseElement), {
    container,
    baseElement,
    unmount,
    debug(element: Element = baseElement): void {
      console.log(prettyDOM(element));
    },
    asFragment(): DocumentFragment {
      const template = document.createElement("template");
      template.innerHTML = container.innerHTML;
      return template.content;
    },
  });
}
