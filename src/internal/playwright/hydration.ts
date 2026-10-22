import type { PlaywrightPage } from "./types";

/**
 * The User Timing mark that `hydrateDusk()` from `@shadow-js/dusk/client` sets once the app is
 * attached to the server's markup.
 * @since 1.0.0
 */
export const DUSK_HYDRATED_MARK = "dusk:hydrated";

/** Default time {@link waitForHydration} waits, in milliseconds. */
const DEFAULT_TIMEOUT = 30_000;

/**
 * Options of {@link waitForHydration}.
 * @since 1.0.0
 */
export interface WaitForHydrationOptions {
  /**
   * The longest time to wait, in milliseconds.
   * @default 30000
   */
  readonly timeout?: number | undefined;
  /**
   * The name of the User Timing mark that signals hydration. A Dusk app sets `"dusk:hydrated"`. An
   * app hydrated some other way sets its own with `performance.mark(name)` when it is interactive.
   * @default "dusk:hydrated"
   */
  readonly mark?: string | undefined;
}

/**
 * Waits until the page in `page` has hydrated.
 *
 * The signal is the `dusk:hydrated` User Timing mark. `hydrateDusk()` sets it, in development and in
 * production, right after the app is attached to the server's markup: from then on the event handlers
 * are live. Server markup is visible, and clickable, before that moment, so a test that clicks too
 * early does nothing and flakes; wait for this first.
 *
 * Limits: the mark is per document, so wait again after a full navigation (a client-side navigation
 * keeps the document and the mark). `@shadow-js/web` alone exposes no hydration signal; an app that
 * calls `hydrate()` itself sets its own mark and passes its name as `mark`. The wait does not detect
 * a hydration that failed: the mark is only set by a successful attach, so a failure ends as a
 * timeout, and the page's errors are in {@link collectProblems}.
 *
 * @param page A Playwright page that has started loading the document.
 * @param options The time limit and the name of the mark. See {@link WaitForHydrationOptions}.
 * @returns A promise that resolves when the mark exists.
 * @throws Error when the mark does not appear within `timeout`; the message says which mark and
 * how long, and the Playwright error is its `cause`.
 * @example
 * import { chromium } from "playwright-core";
 * import { waitForHydration } from "@shadow-js/testing/playwright";
 *
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 * await page.goto("http://127.0.0.1:3000/");
 * await waitForHydration(page, { timeout: 10_000 });
 * await page.click("#count");
 * @see collectProblems
 * @since 1.0.0
 */
export async function waitForHydration(
  page: PlaywrightPage,
  options: WaitForHydrationOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const mark = options.mark ?? DUSK_HYDRATED_MARK;
  try {
    await page.waitForFunction(
      (name: string) => performance.getEntriesByName(name, "mark").length > 0,
      mark,
      { timeout },
    );
  } catch (cause) {
    throw new Error(
      `the page did not hydrate within ${timeout} ms: the performance mark "${mark}" was not set. ` +
        "Dusk apps set it in hydrateDusk(); another app must call performance.mark() itself and pass its name as the mark option.",
      { cause },
    );
  }
}
