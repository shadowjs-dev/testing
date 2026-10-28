---
name: shadowjs-testing
description: "Work with @shadow-js/testing. Testing helpers to render components, query the DOM like a user, fire events and test hooks. Use when a project imports it, or when asked to add, configure or debug it."
---

# @shadow-js/testing

Version 1.0.1. Testing helpers to render components, query the DOM like a user, fire events and test hooks.

## Where to read more

- @shadow-js/testing: https://testing.shadowjs.net
- Source and issues: https://github.com/shadowjs-dev/testing
- The package README is the full reference for options and behavior; read it before changing a configuration.

## Install

```sh
npm install -D @shadow-js/testing @shadow-js/core @shadow-js/web
```

## Peer dependencies

| Package | Range | Required |
| --- | --- | --- |
| `@shadow-js/core` | `^1.0.1` | yes |
| `@shadow-js/web` | `^1.0.1` | yes |
| `vitest` | `^5.0.0` | no |
| `@shadow-js/router` | `^1.0.1` | no |
| `@testing-library/dom` | `^10.4.2` | no |
| `playwright-core` | `^1.50.0` | no |

## Import paths

Import only from these paths. Never from `dist` or `src`: files that are not listed here are private and change without notice.

- `@shadow-js/testing`
- `@shadow-js/testing/dom`
- `@shadow-js/testing/auto-cleanup`
- `@shadow-js/testing/matchers`
- `@shadow-js/testing/routes`
- `@shadow-js/testing/playwright`

## Quick start

```tsx
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

## Working rules

- Run `npm run check` before proposing a change; it lints, builds, type-checks and tests.
- Keep a public change documented: TSDoc on every exported symbol, and a CHANGELOG entry.
- To change this repository rather than use the package, read AGENTS.md: the layout, the commands, the rules and how a pull request is reviewed.
