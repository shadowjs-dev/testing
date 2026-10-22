import type { PlaywrightPage } from "./types";

/** The `window` property that carries the marker of the current document. */
const MARKER_PROPERTY = "__shadowjsClientNavigation";

/** Default time {@link clientNavigate} waits for the link and for the URL, in milliseconds. */
const DEFAULT_TIMEOUT = 15_000;

/**
 * Options of {@link clientNavigate}.
 * @since 1.0.0
 */
export interface ClientNavigateOptions {
  /**
   * The longest time to wait for the link to be clickable and for the URL to change, in milliseconds.
   * @default 15000
   */
  readonly timeout?: number | undefined;
}

/**
 * Follows a link on the page the way a visitor does, and checks that the router handled it in the
 * browser. A marker is set on `window` before the click; a full document load would drop it.
 *
 * It clicks the first `<a>` whose `href` attribute is exactly `href`, waits until the page URL equals
 * `href` (resolved against the current URL), and then checks the marker.
 *
 * @param page A Playwright page that shows a document with a link to `href`.
 * @param href The `href` attribute of the link, for example `"/about"`.
 * @param options The time limit. See {@link ClientNavigateOptions}.
 * @returns A promise that resolves when the URL has changed without a document reload.
 * @throws Error when the link does not exist, the URL does not change in time, or the document was
 * loaded again (the message says so; the link did a full navigation instead of a client one).
 * @example
 * import { chromium } from "playwright-core";
 * import { clientNavigate, waitForHydration } from "@shadow-js/testing/playwright";
 *
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 * await page.goto("http://127.0.0.1:3000/");
 * await waitForHydration(page);
 * await clientNavigate(page, "/about");
 * @see waitForHydration
 * @since 1.0.0
 */
export async function clientNavigate(
  page: PlaywrightPage,
  href: string,
  options: ClientNavigateOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const target = new URL(href, page.url()).href;

  await page.evaluate(
    (arg: { property: string; token: string }) => {
      (globalThis as unknown as Record<string, unknown>)[arg.property] = arg.token;
    },
    { property: MARKER_PROPERTY, token },
  );
  await page
    .locator(`a[href=${JSON.stringify(href)}]`)
    .first()
    .click({ timeout });
  await page.waitForURL((url) => url.href === target, { timeout });

  let kept = false;
  try {
    kept =
      (await page.evaluate(
        (arg: { property: string; token: string }) =>
          (globalThis as unknown as Record<string, unknown>)[arg.property] === arg.token,
        { property: MARKER_PROPERTY, token },
      )) === true;
  } catch {
    // The execution context was destroyed: the document is being replaced, so it was a full load.
  }
  if (!kept) {
    throw new Error(
      `navigating to ${href} loaded a new document instead of staying in the page: the link was not handled by the client router`,
    );
  }
}
