# Changelog

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
