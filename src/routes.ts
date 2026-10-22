/**
 * `@shadow-js/testing/routes`: a router over a memory history, mounted into a container, for tests
 * of route components. It needs `@shadow-js/router` (an optional peer dependency of this package).
 * @packageDocumentation
 */

import { flushSync } from "@shadow-js/core";
import {
  createMemoryHistory,
  createRouter,
  Outlet,
  type RouteDefinition,
  type Router,
  RouterProvider,
} from "@shadow-js/router";
import { createComponent } from "@shadow-js/web";
import { mountView } from "./internal/mount";
import { register } from "./internal/registry";

/**
 * Options of {@link createRoutesStub}.
 * @see createRoutesStub
 * @since 1.0.0
 */
export interface RoutesStubOptions {
  /** The route tree, built with `defineRoute` from `@shadow-js/router`. Required. */
  readonly routes: readonly RouteDefinition[];
  /**
   * The locations the memory history starts with. The last one is the current location.
   * @default ["/"]
   */
  readonly initialEntries?: readonly string[] | undefined;
  /**
   * Values the router passes to its features, as the router's `context` option does.
   * @default No context: the router receives none.
   */
  readonly context?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * What {@link createRoutesStub} returns: the router, and the functions that mount and dispose the
 * rendered view.
 * @see createRoutesStub
 * @since 1.0.0
 */
export interface RoutesStub {
  /**
   * The router. Call `router.navigate(path)` to move, `router.state` to read the location, and
   * `await router.ready()` before the first assertion.
   */
  readonly router: Router;
  /**
   * Renders the router and its outlet into `container`, and flushes the effects before it returns.
   * @param container The element to render into.
   * @default A new `div` appended to the document body. `dispose()` does not remove it.
   * @returns The element the view was rendered into.
   * @throws {Error} When called after `dispose()`.
   */
  mount(container?: HTMLElement): HTMLElement;
  /**
   * Releases everything the stub holds: unmounts the view and runs its cleanups, disposes the router
   * (its history listeners, loader cache and timers) and destroys the memory history the stub created.
   * The container is not removed from the document. `cleanup()` (and the `@shadow-js/testing/auto-cleanup`
   * entry) runs it for a stub the test did not dispose. Safe to call more than once.
   */
  dispose(): void;
}

/**
 * Builds a router over a memory history and mounts it with an outlet, so route components render for
 * a location without a browser. Use it to test route components and the components they render. Route
 * loaders run as they do in the router.
 *
 * @param options The route tree and the starting locations.
 * @returns The router, with `mount` and `dispose` for the rendered view.
 * @example
 * import { defineRoute } from "@shadow-js/router";
 * import { createRoutesStub } from "@shadow-js/testing/routes";
 * import { expect, it } from "vitest";
 *
 * it("renders the user for the location", async () => {
 *   const stub = createRoutesStub({
 *     routes: [defineRoute("/users/$id", { component: () => "user page" })],
 *     initialEntries: ["/users/ada"],
 *   });
 *   await stub.router.ready();
 *   const container = stub.mount();
 *   expect(container.textContent).toContain("user page");
 *   stub.dispose();
 * });
 * @see RoutesStub
 * @since 1.0.0
 */
export function createRoutesStub(options: RoutesStubOptions): RoutesStub {
  const history = createMemoryHistory({ initialEntries: [...(options.initialEntries ?? ["/"])] });
  const router = createRouter({
    routes: options.routes,
    history,
    ...(options.context === undefined ? {} : { context: options.context }),
  });
  let view: { unmount(): void } | undefined;
  let disposed = false;
  // Registered with the cleanup registry, so `cleanup()` releases a stub the test did not dispose. The
  // registry runs a teardown once, so a second dispose (or a cleanup after it) does nothing.
  const release = register(() => {
    disposed = true;
    view?.unmount();
    view = undefined;
    // The router does not own the history it was given, so the stub destroys it after the router let go.
    router.dispose();
    history.destroy();
  });
  return {
    router,
    mount(container?: HTMLElement): HTMLElement {
      if (disposed) throw new Error("createRoutesStub: mount() after dispose()");
      const target = container ?? document.body.appendChild(document.createElement("div"));
      view = mountView(
        () =>
          createComponent(
            RouterProvider as (p: { router: Router; children?: unknown }) => unknown,
            {
              router,
              get children() {
                return createComponent(Outlet as () => unknown, {});
              },
            },
          ),
        { container: target },
      );
      flushSync();
      return target;
    },
    dispose(): void {
      release();
    },
  };
}
