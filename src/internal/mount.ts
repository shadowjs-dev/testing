/**
 * Mounts a view into a container without Testing Library. Shared by `render` (the `dom` entry,
 * which adds the queries) and `createRoutesStub` (the `routes` entry, which needs no queries), so
 * the `routes` entry does not load `@testing-library/dom`.
 * @packageDocumentation
 */
import { untrack } from "@shadow-js/core";
import { hydrate as hydrateView, render as renderView } from "@shadow-js/web";
import { register } from "./registry";

/** The part of `render` options that mounting needs. @internal */
export interface MountOptions {
  readonly container?: HTMLElement;
  readonly baseElement?: HTMLElement;
  readonly wrapper?: (props: { children: unknown }) => unknown;
  readonly hydrate?:
    | boolean
    | { readonly renderId?: string; readonly data?: Record<string, unknown> };
}

/** What a mount returns. @internal */
export interface Mounted {
  readonly container: HTMLElement;
  readonly baseElement: HTMLElement;
  /** Removes the nodes, disposes the owner and runs its cleanups. Safe to call twice. */
  readonly unmount: () => void;
}

/**
 * Mounts `ui` (wrapped when `wrapper` is given), registers its teardown with `cleanup()` and returns
 * the container. Hydration needs a container that already holds the server markup.
 * @internal
 */
export function mountView(ui: () => unknown, options: MountOptions = {}): Mounted {
  const baseElement = options.baseElement ?? options.container ?? document.body;
  const ownsContainer = options.container === undefined;
  const container = options.container ?? baseElement.appendChild(document.createElement("div"));
  const wrapper = options.wrapper;
  const view =
    wrapper === undefined
      ? ui
      : () =>
          untrack(() =>
            wrapper({
              get children() {
                return ui();
              },
            }),
          );
  if (
    options.hydrate !== undefined &&
    options.hydrate !== false &&
    options.container === undefined
  ) {
    throw new TypeError(
      "render(): hydrate needs a container that already holds the server markup.",
    );
  }
  const dispose =
    options.hydrate === undefined || options.hydrate === false
      ? renderView(view, container)
      : hydrateView(view, container, options.hydrate === true ? {} : options.hydrate);
  const unmount = register(() => {
    dispose();
    if (ownsContainer) container.remove();
  });
  return { container, baseElement, unmount };
}
