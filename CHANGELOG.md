# Changelog

## 1.0.3

### Fixed

- `userEvent.type`, `clear`, `keyboard` and `selectOptions` do nothing on disabled controls, read-only fields and disabled options (no value change, no input events).
- `userEvent.click`, `pointer`, `dblClick` and `tab` use the matchers' disabled check (disabled fieldset ancestry); a stray `disabled` attribute on a `div` no longer blocks a click.
- `toHaveStyle("...")` splits declarations outside quotes and parentheses and at the first `:`, and throws a `TypeError` for a declaration or text that does not parse.
- `toBeVisible` treats `opacity: 0` and the content of a closed `<details>` (other than its `<summary>`) as hidden.
- `toHaveTextContent("")` passes only for an element with no text.
- `toHaveTextContent`, `toHaveAccessibleName` and `toHaveAccessibleDescription` give the same answer on every call for a `g` or `y` regular expression.

## 1.0.2

### Fixed

- `render()` and `renderDirective()` remove the container or element they appended when the UI, the directive or its first effect throws (they leaked into the document), and `render({ hydrate: true })` without a `container` throws before it appends anything.
- `userEvent.keyboard("{Tab}")` dispatches one `keydown` instead of two and sends the `keyup` to the element that received focus.
- `toBeDisabled()` and `toBeEnabled()` apply to form controls and custom elements only (a `div` inside a disabled `fieldset` is not disabled) and spare the controls in the first `legend` of a disabled `fieldset`.
- `waitFor` works with Vitest's fake timers (`vi.useFakeTimers()`): each poll advances the fake clock by one `interval` instead of waiting on a clock that never moves, and `timeout` counts fake milliseconds. It finds the fake clock on `setTimeout` itself, so nothing is imported from `vitest`.
- `findBy*` and `findAllBy*` (on `screen`, `within` and a render result) and `waitForElementToBeRemoved` work with Vitest's fake timers like `waitFor`, and a `container` passed in their wait options now picks the DOM snapshot in the timeout error, as in Testing Library.
- `startApp` takes `readyMatch` (text or pattern): the body of the `readyPath` answer must match it, so another process that took the port is not mistaken for the app. An app that ended while the probe was in flight is reported as ended, not ready.
- `freePort` (and so `startApp`) picks a random port from 20000 up to 45000 that it can listen on on the given `host`, and never returns the same port twice in a process, instead of asking the system for port 0: the next ephemeral port is the pool every outbound socket draws from, so another connection could take it before the app started. It rejects at once with the listen error when the host cannot be bound, and after 64 busy ports with an error that names the range.

## 1.0.1

### Changed

- Released at 1.0.1 with the other packages, which share one version. No change to this package.

## 1.0.0

### Added

- Render, hydrate, DOM queries and automatic root cleanup for component tests.
- User-event helpers and utilities for testing effects, hooks and directives.
- `@shadow-js/testing/playwright`: `waitForHydration` (the `dusk:hydrated` mark), `collectProblems`
  (console errors and warnings, page errors, failed requests, 4xx/5xx answers), `clientNavigate`
  (follows a link and fails on a full document load), `startApp` and `freePort` (the app under test on a
  free port, stopped with `SIGINT` then `SIGKILL`), and `createTest`, which adds the `app`, `problems`
  and `hydrated` fixtures to a `@playwright/test` `test`. `playwright-core` is an optional peer
  dependency; the entry imports no Playwright package.
