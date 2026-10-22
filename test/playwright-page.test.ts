import { describe, expect, it } from "vitest";
import {
  clientNavigate,
  collectProblems,
  DUSK_HYDRATED_MARK,
  waitForHydration,
} from "../src/playwright";
import { consoleMessage, failedRequest, fakePage, response } from "./support/fake-page";

describe("collectProblems", () => {
  it("[TST-PW-01] collects console errors and warnings, page errors, failed requests and 4xx/5xx answers", () => {
    const { page, events } = fakePage();
    const collector = collectProblems(page);
    events.emit("console", consoleMessage("error", "boom"));
    events.emit("console", consoleMessage("warning", "careful"));
    events.emit("console", consoleMessage("log", "fine"));
    events.emit("console", consoleMessage("info", "fine"));
    events.emit("pageerror", new Error("uncaught"));
    events.emit("requestfailed", failedRequest("http://x/api", "net::ERR_FAILED"));
    events.emit("response", response("http://x/missing", 404));
    events.emit("response", response("http://x/broken", 500));
    events.emit("response", response("http://x/ok", 200));
    events.emit("response", response("http://x/moved", 302));
    expect(collector.problems()).toEqual([
      { kind: "console.error", text: "boom" },
      { kind: "console.warning", text: "careful" },
      { kind: "pageerror", text: "uncaught" },
      { kind: "requestfailed", text: "net::ERR_FAILED GET http://x/api" },
      { kind: "http", text: "404 http://x/missing" },
      { kind: "http", text: "500 http://x/broken" },
    ]);
  });

  it("[TST-PW-02] ignores the favicon and the console line about a failed resource", () => {
    const { page, events } = fakePage();
    const collector = collectProblems(page);
    events.emit("response", response("http://x/favicon.ico", 404));
    events.emit("response", response("http://x/favicon.ico?v=2", 404));
    events.emit("requestfailed", failedRequest("http://x/favicon.ico", "net::ERR_FAILED"));
    events.emit(
      "console",
      consoleMessage("error", "Failed to load resource: 404", "http://x/favicon.ico"),
    );
    events.emit("console", consoleMessage("error", "other", "http://x/favicon.ico"));
    events.emit(
      "console",
      consoleMessage(
        "error",
        "Failed to load resource: the server responded with 500",
        "http://x/a",
      ),
    );
    expect(collector.problems()).toEqual([]);
    collector.assertNone();
  });

  it("[TST-PW-03] leaves out the problems named by ignore (a substring or a pattern)", () => {
    const { page, events } = fakePage();
    const collector = collectProblems(page, { ignore: ["expected failure", /^404 /] });
    events.emit("console", consoleMessage("error", "an expected failure happened"));
    events.emit("response", response("http://x/missing", 404));
    events.emit("response", response("http://x/broken", 500));
    expect(collector.problems()).toEqual([{ kind: "http", text: "500 http://x/broken" }]);
  });

  it("[TST-PW-04] assertNone throws with one line per problem and passes when there is none", () => {
    const { page, events } = fakePage();
    const collector = collectProblems(page);
    expect(() => collector.assertNone()).not.toThrow();
    events.emit("console", consoleMessage("error", "boom"));
    events.emit("response", response("http://x/broken", 503));
    expect(() => collector.assertNone()).toThrow(
      "the page reported 2 problem(s):\nconsole.error: boom\nhttp: 503 http://x/broken",
    );
  });

  it("[TST-PW-05] dispose removes every listener, keeps the result, and can be called twice", () => {
    const { page, events } = fakePage();
    const collector = collectProblems(page);
    expect(events.eventNames().sort()).toEqual([
      "console",
      "pageerror",
      "requestfailed",
      "response",
    ]);
    events.emit("pageerror", new Error("before"));
    collector.dispose();
    collector.dispose();
    expect(events.eventNames()).toEqual([]);
    expect(collector.problems()).toEqual([{ kind: "pageerror", text: "before" }]);
    collector.problems().length = 0;
    expect(collector.problems()).toHaveLength(1);
  });
});

describe("waitForHydration", () => {
  /** A page whose `waitForFunction` polls the function in this process, as the browser would in the page. */
  function pollingPage(): ReturnType<typeof fakePage> {
    return fakePage({
      waitForFunction: async (fn, arg, options) => {
        const limit = Date.now() + (options?.timeout ?? 1_000);
        while (!fn(arg)) {
          if (Date.now() > limit) throw new Error(`Timeout ${options?.timeout}ms exceeded`);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return true;
      },
    });
  }

  it("[TST-PW-06] resolves once the dusk:hydrated mark exists", async () => {
    const { page } = pollingPage();
    performance.clearMarks(DUSK_HYDRATED_MARK);
    const waiting = waitForHydration(page, { timeout: 2_000 });
    setTimeout(() => performance.mark(DUSK_HYDRATED_MARK), 30);
    await expect(waiting).resolves.toBeUndefined();
    performance.clearMarks(DUSK_HYDRATED_MARK);
  });

  it("[TST-PW-07] waits for the mark the app names", async () => {
    const { page } = pollingPage();
    performance.clearMarks("app:ready");
    const waiting = waitForHydration(page, { timeout: 2_000, mark: "app:ready" });
    performance.mark(DUSK_HYDRATED_MARK);
    setTimeout(() => performance.mark("app:ready"), 30);
    await expect(waiting).resolves.toBeUndefined();
    performance.clearMarks("app:ready");
    performance.clearMarks(DUSK_HYDRATED_MARK);
  });

  it("[TST-PW-08] names the mark and the time limit when the page never hydrates", async () => {
    const { page } = pollingPage();
    performance.clearMarks(DUSK_HYDRATED_MARK);
    const failure = await waitForHydration(page, { timeout: 40 }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("did not hydrate within 40 ms");
    expect((failure as Error).message).toContain(`"${DUSK_HYDRATED_MARK}"`);
    expect((failure as Error).cause).toBeInstanceOf(Error);
  });
});

describe("clientNavigate", () => {
  /** The property the helper keeps its marker in; the test process stands in for the page's `window`. */
  const holder = globalThis as unknown as Record<string, unknown>;

  /** A page that follows a link: `reload` decides whether the click replaces the document. */
  function linkPage(options: { reload: boolean; current?: string }): {
    page: ReturnType<typeof fakePage>["page"];
    clicks: string[];
  } {
    const clicks: string[] = [];
    let current = options.current ?? "http://127.0.0.1:3000/";
    const { page } = fakePage({
      url: () => current,
      evaluate: async (fn, arg) => fn(arg),
      locator: (selector) => ({
        first: () => ({
          first: () => {
            throw new Error("unexpected");
          },
          click: async () => {
            clicks.push(selector);
            const match = /a\[href="(.*)"\]/.exec(selector);
            current = new URL(match?.[1] ?? "", current).href;
            if (options.reload) {
              for (const key of Object.keys(holder)) {
                if (key.startsWith("__shadowjs")) delete holder[key];
              }
            }
          },
        }),
        click: async () => undefined,
      }),
      waitForURL: async (matches) => {
        if (!matches(new URL(current))) throw new Error("the URL did not change");
      },
    });
    return { page, clicks };
  }

  it("[TST-PW-09] clicks the link with that href and resolves when the document stayed", async () => {
    const { page, clicks } = linkPage({ reload: false });
    await expect(clientNavigate(page, "/about?tab=1#top")).resolves.toBeUndefined();
    expect(clicks).toEqual(['a[href="/about?tab=1#top"]']);
  });

  it("[TST-PW-10] fails when the click loaded a new document", async () => {
    const { page } = linkPage({ reload: true });
    await expect(clientNavigate(page, "/about")).rejects.toThrow(
      "navigating to /about loaded a new document",
    );
  });

  it("[TST-PW-11] fails when the page URL does not become the link target", async () => {
    const { page } = fakePage({
      url: () => "http://127.0.0.1:3000/",
      evaluate: async (fn, arg) => fn(arg),
      locator: () => ({
        first: () => ({
          first: () => {
            throw new Error("unexpected");
          },
          click: async () => undefined,
        }),
        click: async () => undefined,
      }),
      waitForURL: async () => {
        throw new Error("Timeout 15000ms exceeded");
      },
    });
    await expect(clientNavigate(page, "/about")).rejects.toThrow("Timeout 15000ms exceeded");
  });
});
