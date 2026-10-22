/**
 * The parts of Playwright that the helpers touch, described structurally. A real `Page` of
 * `playwright-core` or `@playwright/test` satisfies these interfaces, so this package needs neither
 * as a dependency. Only what the helpers call is declared.
 */

/** A console message as Playwright reports it. @since 1.0.0 */
export interface PlaywrightConsoleMessage {
  /** The kind: `"error"`, `"warning"`, `"log"` and so on. */
  type(): string;
  /** The text of the message. */
  text(): string;
  /** Where the message came from. */
  location(): { readonly url: string };
}

/** A network request as Playwright reports it. @since 1.0.0 */
export interface PlaywrightRequest {
  /** The URL of the request. */
  url(): string;
  /** The HTTP method. */
  method(): string;
  /** The reason the request failed, or `null`. */
  failure(): { readonly errorText: string } | null;
}

/** A network response as Playwright reports it. @since 1.0.0 */
export interface PlaywrightResponse {
  /** The URL of the response. */
  url(): string;
  /** The HTTP status code. */
  status(): number;
}

/** The part of a Playwright `Locator` that {@link clientNavigate} uses. @since 1.0.0 */
export interface PlaywrightLocator {
  /** The first matching element. */
  first(): PlaywrightLocator;
  /** Clicks the element once it can be clicked. */
  click(options?: { timeout?: number }): Promise<void>;
}

/**
 * The part of a Playwright `Page` the helpers use: events for {@link collectProblems}, `evaluate`
 * and `waitForFunction` for {@link waitForHydration}, and the locator and URL methods for
 * {@link clientNavigate}. A Playwright `Page` is assignable to it.
 * @since 1.0.0
 */
export interface PlaywrightPage {
  /** Subscribes to console messages. */
  on(event: "console", listener: (message: PlaywrightConsoleMessage) => void): unknown;
  /** Subscribes to uncaught page errors. */
  on(event: "pageerror", listener: (error: Error) => void): unknown;
  /** Subscribes to requests that failed. */
  on(event: "requestfailed", listener: (request: PlaywrightRequest) => void): unknown;
  /** Subscribes to responses. */
  on(event: "response", listener: (response: PlaywrightResponse) => void): unknown;
  /** Removes a console listener. */
  off(event: "console", listener: (message: PlaywrightConsoleMessage) => void): unknown;
  /** Removes a page error listener. */
  off(event: "pageerror", listener: (error: Error) => void): unknown;
  /** Removes a failed request listener. */
  off(event: "requestfailed", listener: (request: PlaywrightRequest) => void): unknown;
  /** Removes a response listener. */
  off(event: "response", listener: (response: PlaywrightResponse) => void): unknown;
  /** Runs a function in the page. */
  evaluate<Arg>(pageFunction: (arg: Arg) => unknown, arg: Arg): Promise<unknown>;
  /** Waits until a function run in the page returns a truthy value. */
  waitForFunction<Arg>(
    pageFunction: (arg: Arg) => unknown,
    arg: Arg,
    options?: { timeout?: number },
  ): Promise<unknown>;
  /** A locator for a selector. */
  locator(selector: string): PlaywrightLocator;
  /** Waits until the page URL satisfies the predicate. */
  waitForURL(url: (url: URL) => boolean, options?: { timeout?: number }): Promise<void>;
  /** The current URL. */
  url(): string;
}
