<p align="center"><img src="https://raw.githubusercontent.com/shadowjs-dev/testing/main/.github/banner.png" alt="ShadowJS" width="100%"></p>

# @shadow-js/testing

[![npm](https://img.shields.io/npm/v/@shadow-js/testing.svg)](https://www.npmjs.com/package/@shadow-js/testing)
[![CI](https://github.com/shadowjs-dev/testing/actions/workflows/ci.yml/badge.svg)](https://github.com/shadowjs-dev/testing/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/shadowjs-dev/testing/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)

Testing Library-style helpers for ShadowJS 1.0.0: render components into happy-dom or jsdom,
query the DOM the way users see it, fire events, type into fields, wait for resources, test hooks,
and capture development warnings. Everything is synchronous unless you ask for a promise, and
every helper leaves the DOM flushed when it returns.

## Install

```sh
npm install -D @shadow-js/testing vitest happy-dom @testing-library/dom
```

`@shadow-js/core` and `@shadow-js/web` are peer dependencies; `vitest` is an optional peer
dependency, needed by the `auto-cleanup` entry. `@testing-library/dom` is an optional peer too, and the
`dom` entry imports it, so install it with the package (npm does not install optional peers for you).
ShadowJS 1.0.0 is not on npm yet. Until it is
published, install it from this repository.

## Entries

| Entry | Use |
| --- | --- |
| `@shadow-js/testing` | stores, hooks and async helpers, with no DOM |
| `@shadow-js/testing/dom` | rendering, queries (`within`, `findBy*`), `fireEvent`, `userEvent`, `prettyDOM`, `logRoles` |
| `@shadow-js/testing/auto-cleanup` | unmounts after each test |
| `@shadow-js/testing/matchers` | the jest-dom matchers, registered with vitest's `expect` (the accessible-name matchers are `accessibleMatchers` in `dom`) |
| `@shadow-js/testing/routes` | `createRoutesStub`: route components over a memory router (needs `@shadow-js/router`) |
| `@shadow-js/testing/playwright` | helpers for tests in a real browser: `waitForHydration`, `collectProblems`, `clientNavigate`, `startApp`, `createTest` (Node; needs Playwright) |

## Setup

Tests need the ShadowJS compiler to turn JSX into DOM code, so run them through the ShadowJS Vite
plugin, and use the `dom` environment (happy-dom). Register cleanup once in a setup file:

```ts title="vitest.setup.ts" typecheck
import "@shadow-js/testing/auto-cleanup";
```

```ts title="vitest.config.ts" typecheck
import shadow from "@shadow-js/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [shadow()],
  test: { environment: "happy-dom", setupFiles: ["./vitest.setup.ts"] },
});
```

Without the auto-cleanup entry, call `cleanup()` yourself in `afterEach`. It unmounts every render
and root created since the last call.

## Example

A component with a signal, a resource and a context, and tests that use each part of the API.
The component is checked as a module, and the tests below it run as part of the documentation test
suite.

```tsx title="profile.tsx" run
import { createContext, useContext, useResource, useStore } from "@shadow-js/core";

export const Locale = createContext("en");

export function Profile(props: { load: () => Promise<string> }) {
  const [clicks, setClicks] = useStore(0);
  const user = useResource(() => props.load());
  const greeting = useContext(Locale) === "fr" ? "Bonjour" : "Hello";
  return (
    <section>
      <h2>Profile</h2>
      <p>{user.error ? "failed" : user.loading ? "loading" : `${greeting}, ${user.latest}`}</p>
      <button onClick={() => setClicks(clicks() + 1)}>clicks {clicks()}</button>
      <label>
        Nickname <input />
      </label>
    </section>
  );
}
```

```tsx title="profile.test.tsx" test
import { describe, expect, it } from "vitest";
import {
  fireEvent,
  mockResource,
  render,
  renderHook,
  userEvent,
} from "@shadow-js/testing/dom";
import { useStore } from "@shadow-js/core";
import { Locale, Profile } from "./profile";

describe("Profile", () => {
  it("shows the loading state, then the resolved value", async () => {
    const request = mockResource<string>();
    const view = render(() => Profile({ load: request.fetch }));

    expect(view.getByText("loading")).toBeTruthy();
    request.resolve("Ada");
    expect(await view.findByText("Hello, Ada")).toBeTruthy();
  });

  it("updates the button when clicked, without awaiting", () => {
    const request = mockResource<string>();
    const view = render(() => Profile({ load: request.fetch }));
    const button = view.getByRole("button", { name: "clicks 0" });

    fireEvent.click(button);

    expect(button.textContent).toBe("clicks 1");
  });

  it("types into the nickname field", () => {
    const request = mockResource<string>();
    const view = render(() => Profile({ load: request.fetch }));
    const field = view.getByLabelText<HTMLInputElement>("Nickname");

    userEvent.type(field, "ada");

    expect(field.value).toBe("ada");
  });

  it("reads the locale from a wrapper that provides context", async () => {
    const request = mockResource<string>();
    const view = render(() => Profile({ load: request.fetch }), {
      wrapper: (props) =>
        Locale({
          value: "fr",
          get children() {
            return props.children;
          },
        }),
    });
    request.resolve("Ada");
    expect(await view.findByText("Bonjour, Ada")).toBeTruthy();
  });

  it("unmounts and disposes the owner", () => {
    const view = render(() => Profile({ load: () => new Promise<string>(() => undefined) }));
    view.unmount();
    expect(view.container.isConnected).toBe(false);
  });
});

describe("hooks", () => {
  it("runs a hook inside an owner and reads signals through accessors", () => {
    const { result, dispose } = renderHook(() => useStore(1));
    const [count, setCount] = result.current;
    setCount(2);
    expect(count()).toBe(2);
    dispose();
  });
});
```

## API

| Export | Entry | Description |
| --- | --- | --- |
| `render` | `/dom` | Mounts a UI, flushes, and returns the bound queries plus `container`, `unmount`, `debug`, `asFragment`. |
| `fireEvent` | `/dom` | Dispatches one DOM event (one helper per event type) and flushes ShadowJS effects. |
| `userEvent` | `/dom` | Synchronous `type`, `clear`, `click`, `tab`, `keyboard`, `hover`, `unhover`, `dblClick`, `selectOptions` and `pointer`. |
| `screen`, `within` | `/dom` | Queries over `document.body`, or bound to one element. |
| `renderDirective`, `waitForElementToBeRemoved`, `prettyDOM`, `logRoles` | `/dom` | Apply a directive under test, wait for a removal, and print the DOM or the roles. |
| `waitFor`, `findBy*`, `findAllBy*` | `/dom` | Polling helpers that flush effects before each poll. |
| `act` | root | Runs a callback and flushes the effects it caused. |
| `flush` | root | Awaits pending promise callbacks, then flushes every queued effect. |
| `testEffect` | root | Runs an effect that must run more than once, until it calls `done()`. |
| `renderHook` | root | Runs a hook once inside an owner and exposes its result. |
| `createTestRoot` | root | Runs a function in a fresh ownership root and returns its value and a dispose function. |
| `captureWarnings` | root | Collects every `console.warn` that core and web raise while a function runs. |
| `mockResource`, `deferred` | root | A controllable fetcher for `useResource`; a promise you settle by hand. |
| `cleanup` | root | Disposes everything still mounted, newest first. |
| `waitForHydration`, `collectProblems`, `clientNavigate` | `/playwright` | Wait for a Dusk page to hydrate, collect what a page did wrong, follow a link through the client router. |
| `startApp`, `freePort`, `createTest` | `/playwright` | Start the app under test on a free port; a Playwright `test` with `app`, `problems` and `hydrated` fixtures. |

Subpath entries:

| Entry | Contents | DOM needed |
| --- | --- | --- |
| `@shadow-js/testing` | `act`, `flush`, `testEffect`, `createTestRoot`, `renderHook`, `captureWarnings`, `deferred`, `mockResource`, `cleanup` | no |
| `@shadow-js/testing/dom` | everything above, plus `render`, `fireEvent`, `userEvent`, `waitFor` and the queries | yes |
| `@shadow-js/testing/auto-cleanup` | side-effect entry that registers `afterEach(cleanup)` | Vitest |
| `@shadow-js/testing/playwright` | `waitForHydration`, `collectProblems`, `clientNavigate`, `startApp`, `freePort`, `createTest` | no (a real browser, driven from Node) |

### `render(ui, options?)`

Mounts `ui` with the web renderer and flushes. Returns a `RenderResult`:

- `container`, the element the output went into. By default a `div` appended to `baseElement`.
- `baseElement`, the element the queries search within. Defaults to `container` when you pass one,
  otherwise `document.body`.
- Every Testing Library query bound to `baseElement` (`getByRole`, `queryAllByText`, `findByLabelText`, ...).
- `unmount()` removes the rendered nodes, disposes the owner (cleanups run) and removes the container
  that `render` created. Calling it again does nothing.
- `debug(element?)` logs the pretty-printed DOM.
- `asFragment()` returns a snapshot that later updates do not change.

Options: `container`, `baseElement`, and `wrapper`, a function `({ children }) => ...`. The UI is passed
as the `children` getter, so `{props.children}` renders it inside the wrapper's owner.

There is no `rerender()`. A ShadowJS component runs once and changes through the signals it reads, so
a test changes the UI by writing a signal (inside `flushSync` or followed by `await flush()`).

### `fireEvent`

`fireEvent.click(el)`, `input`, `change`, `keyDown`, `keyUp`, `submit`, `focus`, `blur`, `pointerDown`,
and so on (about 45 event types), plus the call form `fireEvent(el, event)`. Each dispatches a bubbling
event as Testing Library defines it, flushes ShadowJS effects, and returns `false` when a listener
canceled the event. Pass `{ target: { value } }` to set a field's value before dispatch.

### `userEvent`

Synchronous and simplified:

- `type(field, text)` focuses the field, then for each character dispatches keydown, appends it,
  dispatches input, flushes, dispatches keyup. Throws a `TypeError` for elements that are not an
  `input` or `textarea`.
- `clear(field)` empties the field and dispatches input.
- `click(el)` dispatches pointer down and up, focuses, and clicks. Disabled elements get nothing.
- `tab({ shift? })` moves focus through the focusable elements in document order, skipping disabled
  ones and wrapping around.

### `waitFor(callback, options?)` and `findBy*` / `findAllBy*`

Testing Library's semantics, but every poll first flushes queued effects. Each query family
(`Text`, `LabelText`, `Role`, `PlaceholderText`, `AltText`, `Title`, `DisplayValue`, `TestId`) has a
`findBy` and a `findAllBy` variant with the options and waitFor options as trailing arguments:
`view.findByRole("button", { name: "Save" }, { timeout: 2000 })`.

Under `vi.useFakeTimers()` they all work the same way: each poll advances the fake clock by one
`interval`, and `timeout` counts fake milliseconds.

### `flush()`

Awaits a few microtasks, then flushes. Use it after writes made outside an event, for example when
a timer or a resource changes a signal.

### `mockResource<T>()` and `deferred<T>()`

`mockResource` returns a fetcher (`fetch`) for `useResource`, plus `calls`, `pending`, and
`resolve(value)` / `reject(error)`. Those settle the oldest pending request and throw when none is
pending. `deferred<T>()` gives a promise with `resolve` and `reject`, for code under test that
awaits something you control.

### `renderHook(hook, options?)`

Runs `hook` once inside an owner, flushed. `result.current` is the hook's return value, and
`dispose()` tears it down. Reactive values are accessors, so read them to see updates. With a
`wrapper`, the hook runs when the wrapper reads `props.children`. A wrapper that never does throws.

### `createTestRoot(setup)`

Runs `setup` in a root and returns `{ value, dispose }`. The root is also disposed by `cleanup()`.

### `captureWarnings(fn)`

Runs `fn` synchronously and returns `{ value, messages }`, where `messages` holds every
`console.warn` that core and web raised. `console.warn` is restored even when `fn` throws.

### `cleanup()`

Disposes everything still mounted, newest first. A teardown that throws does not stop the others;
the errors are rethrown together after all have run.

### Playwright helpers (`@shadow-js/testing/playwright`)

For tests that run the app in a real browser. The entry runs in Node, imports nothing from Playwright,
and describes the few `Page` members it uses, so it works with `playwright-core` and with `@playwright/test`.
Neither is a dependency: install the one you use (`playwright-core` is an optional peer).

- `waitForHydration(page, { timeout?, mark? })` resolves when the `dusk:hydrated` User Timing mark exists.
  `hydrateDusk()` sets it right after the app is attached to the server markup. `@shadow-js/web` alone
  exposes no hydration signal: an app that calls `hydrate()` itself sets its own mark and passes the name.
- `collectProblems(page, { ignore? })` returns `{ problems(), assertNone(), dispose() }` for console errors
  and warnings, page errors, failed requests and 4xx/5xx answers. The favicon request is ignored.
- `clientNavigate(page, href, { timeout? })` clicks the link, waits for the URL, and fails if the document
  was loaded again (a marker on `window` is gone).
- `startApp(options)` starts a command on a free port (`shell: false`), waits until it answers, and returns
  `{ url, port, output(), stop() }`; `stop()` sends `SIGINT`, then `SIGKILL` after `stopTimeout`.
  `freePort()` is the port discovery on its own.
- `createTest(test)` returns the `@playwright/test` `test` with the options `appServer` and
  `problemsOptions` and the fixtures `app`, `problems` (an auto fixture that fails the test at its end) and
  `hydrated(path?)`. The `app` fixture also sets `baseURL`.

Limits: `startApp` starts the program you name, not a shell, so on Windows give `process.execPath` and a
script instead of `npm` or `npx` (they are `.cmd` files). The process is signaled, not its children:
start the server program itself. The free port is chosen and released before the server binds it.
See the [testing guide](https://shadowjs.net/guides/testing/) for a complete setup.

## Limits

- Core reports each development warning code once per module instance. A second `captureWarnings`
  for the same code in the same test file sees nothing. Assert warnings in the first test that
  triggers them.
- `findBy*` returns `HTMLElement`. The generic element parameter of Testing Library is not supported.
- `userEvent` is not a browser. It has no keyboard layout, IME, selection model, or pointer geometry.
  Use `fireEvent` when you need an exact event sequence, and the `playwright` entry for a real browser.
- `screen` searches the whole `document.body`. Use `within(element)` or the queries on the value `render`
  returns to search a part of the page.
- Use happy-dom, or any DOM with `MutationObserver` and `KeyboardEvent`, `InputEvent` and
  `MouseEvent` constructors.

## Links

- [`@shadow-js/web`](https://shadowjs.net/reference/web/), [`@shadow-js/core`](https://shadowjs.net/reference/core/), [`@shadow-js/vite`](https://shadowjs.net/guides/vite/)

`@testing-library/dom` is an optional peer dependency: install it to use `@shadow-js/testing/dom`. The root, `matchers`, `auto-cleanup`, `routes` and `playwright` entries do not load it.

## Dependencies

- Runtime: none.
- Peers: `@shadow-js/core` and `@shadow-js/web` `^1.0.0`: the runtime the test helpers render with.
- Optional peers: `vitest` `^5.0.0` for `expect` and `afterEach` (`src/matchers.ts`, `src/auto-cleanup.ts`).
- Optional peers: `@testing-library/dom` `^10.4.2` for accessible matchers in `@shadow-js/testing/dom`.
- Optional peers: `@shadow-js/router` `^1.0.0` for route rendering in the `routes` entry (`src/routes.ts`).
- Optional peers: `playwright-core` `^1.50.0` (or `@playwright/test`, which includes it) for the `playwright` entry. The entry imports neither: it types the parts of `Page` it uses, so any Playwright version with those members works.

## Types

- Names from the root: `TestRoot`, `createTestRoot`, `RenderHookOptions`, `RenderHookResult`, `MockResource`, `mockResource`, `Deferred`, `deferred`.
- Names from `/playwright`: `waitForHydration`, `collectProblems`, `clientNavigate`, `startApp`, `freePort`, `createTest`, `DUSK_HYDRATED_MARK`, and the types `PageProblem`, `ProblemCollector`, `AppServerOptions`, `RunningApp`, `ShadowFixtures`, `ShadowOptions`, `ShadowTest`, `PlaywrightPage`.
- Type tests in `test-types/` are compile-time checks; `npm run typecheck:types` runs them.

## Support

- Node.js `>=22.12.0`. ESM only: use `import`; `require` is not supported.
- Browsers: current evergreen releases.
- Versioning: every `@shadow-js/*` package releases together at one version. Upgrade them as one set.
- Documentation: [ShadowJS documentation](https://shadowjs.net).

## Using, changing and contributing

- **Use the package** (a person or a coding agent that builds with it): this README, and [SKILL.md](SKILL.md), the short page an agent reads first.
- **Change the package** (fix a bug, add a feature): [AGENTS.md](AGENTS.md) says how the repository is laid out, how to implement and test a change, and how a pull request is reviewed. It is written for people and coding agents alike.
- **Take part**: [CONTRIBUTING.md](CONTRIBUTING.md) is the short guide; [SECURITY.md](SECURITY.md) is for vulnerabilities.
