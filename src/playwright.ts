/**
 * `@shadow-js/testing/playwright`: helpers for end-to-end tests that drive a real browser with
 * Playwright. Wait for hydration, collect what the page did wrong, start the app under test on a
 * free port, and follow links through the client router. `playwright-core` (or `@playwright/test`)
 * is an optional peer dependency: the helpers describe the parts of a `Page` they use, and nothing
 * here imports Playwright. The entry runs in Node.
 * @packageDocumentation
 */

export {
  type AppServerOptions,
  freePort,
  type RunningApp,
  startApp,
} from "./internal/playwright/app";
export {
  createTest,
  type PlaywrightTestBase,
  type ShadowFixtures,
  type ShadowOptions,
  type ShadowTest,
  type ShadowTestArgs,
  type ShadowTestCall,
} from "./internal/playwright/fixtures";
export {
  DUSK_HYDRATED_MARK,
  type WaitForHydrationOptions,
  waitForHydration,
} from "./internal/playwright/hydration";
export { type ClientNavigateOptions, clientNavigate } from "./internal/playwright/navigate";
export {
  type CollectProblemsOptions,
  collectProblems,
  type PageProblem,
  type ProblemCollector,
} from "./internal/playwright/problems";
export type {
  PlaywrightConsoleMessage,
  PlaywrightLocator,
  PlaywrightPage,
  PlaywrightRequest,
  PlaywrightResponse,
} from "./internal/playwright/types";
