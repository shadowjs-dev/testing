import { type AppServerOptions, type RunningApp, startApp } from "./app";
import { type WaitForHydrationOptions, waitForHydration } from "./hydration";
import { type CollectProblemsOptions, collectProblems, type ProblemCollector } from "./problems";
import type { PlaywrightPage } from "./types";

/**
 * The fixtures that {@link createTest} adds to a Playwright `test`.
 * @since 1.0.0
 */
export interface ShadowFixtures {
  /**
   * The application started from the `appServer` option: its `url` and `port`. One process per
   * worker, stopped when the worker ends. Also sets `baseURL`, so `page.goto("/")` works.
   */
  app: RunningApp;
  /**
   * The problems of `page` (see {@link collectProblems}). It is an auto fixture: every test starts
   * collecting, and fails at its end when the page reported a problem. Tests may read `problems()`.
   */
  problems: ProblemCollector;
  /**
   * Navigates `page` to a path of the app (default `"/"`) and waits until the page has hydrated
   * (see {@link waitForHydration}; `options` is passed on). Resolves with nothing; keep using the
   * `page` fixture.
   */
  hydrated: (path?: string, options?: WaitForHydrationOptions) => Promise<void>;
}

/**
 * The options that {@link createTest} adds; set them with `test.use()` or in `playwright.config.ts`.
 * @since 1.0.0
 */
export interface ShadowOptions {
  /** How to start the application. Required: without it a test that needs `app` fails with a clear message. */
  appServer: AppServerOptions | undefined;
  /** Expected problems, passed to {@link collectProblems} for every test. */
  problemsOptions: CollectProblemsOptions;
}

/** The part of a Playwright fixture function that this module relies on. */
type FixtureUse<Value> = (value: Value) => Promise<void>;

/**
 * The part of Playwright's `test` that {@link createTest} needs: `extend`. Described structurally so
 * that `@playwright/test` is not a dependency of this package.
 * @since 1.0.0
 */
export interface PlaywrightTestBase {
  /** Adds fixtures; Playwright validates and types them. */
  extend(fixtures: never): unknown;
}

/**
 * What a test body or hook receives: the arguments of the base test (`page`, `context`, and the
 * fixtures of earlier `extend` calls) and the {@link ShadowFixtures}.
 * @since 1.0.0
 */
export type ShadowTestArgs<Base> = (Base extends {
  (title: string, body: (args: infer Args, info: infer _Info) => unknown): void;
  (
    title: string,
    details: infer _Details,
    body: (args: infer _Args, info: infer _Info2) => unknown,
  ): void;
}
  ? Args
  : object) &
  ShadowFixtures;

/** A test body or hook callback that receives the fixtures. */
type ShadowBody<Base> = (fixtures: ShadowTestArgs<Base>) => Promise<void> | void;

/**
 * Declares a test whose body receives {@link ShadowTestArgs}.
 * @since 1.0.0
 */
export interface ShadowTestCall<Base> {
  /** Declares a test. */
  (title: string, body: ShadowBody<Base>): void;
  /** Declares a test with details such as `tag` or `annotation`. */
  (title: string, details: object, body: ShadowBody<Base>): void;
}

/**
 * The test {@link createTest} returns. Calling it declares a test and `test.only`, `test.beforeEach`
 * and `test.afterEach` take bodies that receive the {@link ShadowFixtures}; every other member
 * (`describe`, `skip`, `step`, `extend`, `expect`) is the base test's own. `test.use()` also accepts
 * the {@link ShadowOptions}.
 * @since 1.0.0
 */
export type ShadowTest<Base> = ShadowTestCall<Base> &
  Omit<Base, "use" | "only" | "beforeEach" | "afterEach"> & {
    /** Sets options (the {@link ShadowOptions} and Playwright's own) for the tests of a file or group. */
    use(options: Partial<ShadowOptions> & Record<string, unknown>): void;
    /** Declares a test that runs alone. */
    only: ShadowTestCall<Base>;
    /** Registers a hook that runs before every test of the file or group. */
    beforeEach(body: ShadowBody<Base>): void;
    /** Registers a hook that runs after every test of the file or group. */
    afterEach(body: ShadowBody<Base>): void;
  };

/**
 * Extends Playwright's `test` with fixtures for ShadowJS apps.
 *
 * - `appServer` (option): how to start the app, see {@link AppServerOptions}.
 * - `app`: starts it on a free port, waits until it answers, and stops it after the last test of the
 *   worker (`SIGINT`, then `SIGKILL`). It also provides `baseURL`.
 * - `problems`: collects console errors and warnings, page errors, failed requests and 4xx/5xx
 *   answers of `page`, and fails the test at its end if there was any. Expected ones go in the
 *   `problemsOptions` option.
 * - `hydrated(path?)`: opens a path and waits for hydration.
 *
 * @param base The `test` exported by `@playwright/test`, or one made from it with `extend`.
 * @returns A test with the fixtures added.
 * @example
 * // e2e/test.ts
 * import { test as base } from "@playwright/test";
 * import { createTest } from "@shadow-js/testing/playwright";
 *
 * export const test = createTest(base);
 * @see AppServerOptions
 * @see ShadowFixtures
 * @since 1.0.0
 */
export function createTest<Base extends PlaywrightTestBase>(base: Base): ShadowTest<Base> {
  const fixtures = {
    appServer: [undefined, { option: true, scope: "worker" }],
    problemsOptions: [{}, { option: true }],
    app: [
      async (
        { appServer }: { appServer: AppServerOptions | undefined },
        use: FixtureUse<RunningApp>,
      ) => {
        if (appServer === undefined) {
          throw new Error(
            "no application to test: set the appServer option, for example test.use({ appServer: { command: process.execPath, args: [...] } })",
          );
        }
        const running = await startApp(appServer);
        try {
          await use(running);
        } finally {
          await running.stop();
        }
      },
      { scope: "worker", timeout: 0 },
    ],
    baseURL: async ({ app }: { app: RunningApp }, use: FixtureUse<string>) => {
      await use(app.url);
    },
    problems: [
      async (
        {
          page,
          problemsOptions,
        }: { page: PlaywrightPage; problemsOptions: CollectProblemsOptions },
        use: FixtureUse<ProblemCollector>,
      ) => {
        const collector = collectProblems(page, problemsOptions);
        try {
          await use(collector);
          collector.assertNone();
        } finally {
          collector.dispose();
        }
      },
      { auto: true },
    ],
    hydrated: async (
      { page }: { page: PlaywrightPage & { goto(url: string): Promise<unknown> } },
      use: FixtureUse<ShadowFixtures["hydrated"]>,
    ) => {
      await use(async (path = "/", options) => {
        await page.goto(path);
        await waitForHydration(page, options);
      });
    },
  };
  return base.extend(fixtures as never) as ShadowTest<Base>;
}
