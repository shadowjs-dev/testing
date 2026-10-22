import { EventEmitter } from "node:events";
import type {
  PlaywrightConsoleMessage,
  PlaywrightPage,
  PlaywrightRequest,
  PlaywrightResponse,
} from "../../src/internal/playwright/types";

/** A page whose events the test emits; the rest of `PlaywrightPage` is filled in per test. */
export interface FakePage {
  readonly page: PlaywrightPage;
  readonly events: EventEmitter;
}

/**
 * A `PlaywrightPage` backed by an event emitter. The browser is the boundary of the helpers, so the
 * unit tests drive them with the events Playwright would emit; the browser tier runs them for real.
 */
export function fakePage(overrides: Partial<PlaywrightPage> = {}): FakePage {
  const events = new EventEmitter();
  const base: PlaywrightPage = {
    on: events.on.bind(events) as PlaywrightPage["on"],
    off: events.off.bind(events) as PlaywrightPage["off"],
    evaluate: () => Promise.reject(new Error("evaluate is not set")),
    waitForFunction: () => Promise.reject(new Error("waitForFunction is not set")),
    locator: () => {
      throw new Error("locator is not set");
    },
    waitForURL: () => Promise.reject(new Error("waitForURL is not set")),
    url: () => "http://127.0.0.1/",
  };
  return { page: { ...base, ...overrides }, events };
}

/** A console message with the given type, text and source URL. */
export function consoleMessage(type: string, text: string, url = ""): PlaywrightConsoleMessage {
  return { type: () => type, text: () => text, location: () => ({ url }) };
}

/** A failed request. */
export function failedRequest(url: string, errorText: string): PlaywrightRequest {
  return { url: () => url, method: () => "GET", failure: () => ({ errorText }) };
}

/** A response. */
export function response(url: string, status: number): PlaywrightResponse {
  return { url: () => url, status: () => status };
}
