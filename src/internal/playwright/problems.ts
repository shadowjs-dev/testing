import type {
  PlaywrightConsoleMessage,
  PlaywrightPage,
  PlaywrightRequest,
  PlaywrightResponse,
} from "./types";

/**
 * One thing a page did wrong while a test ran.
 * @since 1.0.0
 */
export interface PageProblem {
  /**
   * What happened: a `console.error` or `console.warning` message, an uncaught `pageerror`, a
   * `requestfailed` (the network failed) or an `http` answer with status 400 or above.
   */
  readonly kind: "console.error" | "console.warning" | "pageerror" | "requestfailed" | "http";
  /** The message, the error text, or the status and URL. */
  readonly text: string;
}

/**
 * Options of {@link collectProblems}.
 * @since 1.0.0
 */
export interface CollectProblemsOptions {
  /**
   * Problems that are expected. A string matches when it occurs in the problem's text, a regular
   * expression when it matches it. A matching problem is not collected.
   * @default [] (nothing is expected)
   */
  readonly ignore?: readonly (string | RegExp)[] | undefined;
}

/**
 * What {@link collectProblems} returns.
 * @since 1.0.0
 */
export interface ProblemCollector {
  /** The problems collected so far, in the order they happened. A new array on every call. */
  problems(): PageProblem[];
  /**
   * Fails when the page reported a problem.
   * @throws Error that lists every problem, one per line.
   */
  assertNone(): void;
  /** Stops listening. Problems collected so far stay readable. Calling it again does nothing. */
  dispose(): void;
}

/** The console text Chromium adds for a failed resource; the network event already names the cause. */
const RESOURCE_NOISE = "Failed to load resource";

/**
 * Formats problems for an error message or a report.
 * @param problems The problems to format.
 * @returns One line per problem, `kind: text`; an empty string for none.
 */
export function formatProblems(problems: readonly PageProblem[]): string {
  return problems.map((problem) => `${problem.kind}: ${problem.text}`).join("\n");
}

/** Whether the browser asked for the favicon by itself; its 404 is not the page's fault. */
function isFavicon(url: string): boolean {
  const query = url.search("[?#]");
  return (query === -1 ? url : url.slice(0, query)).endsWith("/favicon.ico");
}

/**
 * Starts collecting what a page does wrong: console errors and warnings, uncaught page errors,
 * network failures, and answers with status 400 or above. The browser's own request for
 * `/favicon.ico` is ignored, and so is Chromium's console line about a failed resource (the network
 * event already reports that request, with its status or reason).
 *
 * Call it before `page.goto()`; problems that happen earlier are not seen.
 *
 * @param page A Playwright page (`playwright-core` or `@playwright/test`).
 * @param options Expected problems to leave out. See {@link CollectProblemsOptions}.
 * @returns The collector: `problems()`, `assertNone()` and `dispose()`.
 * @example
 * import { chromium } from "playwright-core";
 * import { collectProblems } from "@shadow-js/testing/playwright";
 *
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 * const collector = collectProblems(page);
 * try {
 *   await page.goto("http://127.0.0.1:3000/");
 *   collector.assertNone();
 * } finally {
 *   collector.dispose();
 *   await browser.close();
 * }
 * @see waitForHydration
 * @since 1.0.0
 */
export function collectProblems(
  page: PlaywrightPage,
  options: CollectProblemsOptions = {},
): ProblemCollector {
  const ignore = options.ignore ?? [];
  const found: PageProblem[] = [];
  let disposed = false;

  const add = (problem: PageProblem): void => {
    for (const pattern of ignore) {
      if (
        typeof pattern === "string" ? problem.text.includes(pattern) : pattern.test(problem.text)
      ) {
        return;
      }
    }
    found.push(problem);
  };
  const onConsole = (message: PlaywrightConsoleMessage): void => {
    const type = message.type();
    if (type !== "error" && type !== "warning") return;
    const text = message.text();
    if (text.startsWith(RESOURCE_NOISE) || isFavicon(message.location().url)) return;
    add({ kind: type === "error" ? "console.error" : "console.warning", text });
  };
  const onPageError = (error: Error): void => add({ kind: "pageerror", text: error.message });
  const onRequestFailed = (request: PlaywrightRequest): void => {
    if (isFavicon(request.url())) return;
    const reason = request.failure()?.errorText ?? "failed";
    add({ kind: "requestfailed", text: `${reason} ${request.method()} ${request.url()}` });
  };
  const onResponse = (response: PlaywrightResponse): void => {
    const status = response.status();
    if (status < 400 || isFavicon(response.url())) return;
    add({ kind: "http", text: `${status} ${response.url()}` });
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    problems: () => [...found],
    assertNone(): void {
      if (found.length === 0) return;
      throw new Error(`the page reported ${found.length} problem(s):\n${formatProblems(found)}`);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}
