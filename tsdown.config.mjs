import { createConfig } from "./build/tsdown-preset.mjs";

const builds = createConfig({
  entries: {
    index: "src/index.ts",
    dom: "src/dom.ts",
    "auto-cleanup": "src/auto-cleanup.ts",
    matchers: "src/matchers.ts",
    routes: "src/routes.ts",
    playwright: "src/playwright.ts",
  },
  packageDir: import.meta.dirname,
});

// The `playwright` entry runs in Node and imports `node:child_process` and `node:net`; on the shared
// "neutral" platform such imports would be reported as unresolved. They are external by design.
export default builds.map((build) => ({ ...build, deps: { neverBundle: [/^node:/] } }));
