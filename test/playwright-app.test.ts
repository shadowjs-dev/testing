import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { expandPlaceholders } from "../src/internal/playwright/app";
import {
  type AppServerOptions,
  createTest,
  freePort,
  type PlaywrightTestBase,
  type RunningApp,
  startApp,
} from "../src/playwright";
import { fakePage } from "./support/fake-page";

/** A server in a child process: it answers `{path, port, host}` as JSON and ends on SIGINT. */
const SERVER = `
const http = require("node:http");
http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ path: req.url, port: process.env.PORT, host: process.env.HOST, extra: process.env.EXTRA }));
}).listen(Number(process.env.PORT), process.env.HOST);
process.on("SIGINT", () => process.exit(0));
`;

/** The same server, but SIGINT is ignored: only SIGKILL ends it. */
const STUBBORN = `${SERVER.replace('process.on("SIGINT", () => process.exit(0));', 'process.on("SIGINT", () => {});')}`;

function serverOptions(script: string, rest: Partial<AppServerOptions> = {}): AppServerOptions {
  return { command: process.execPath, args: ["-e", script], stopTimeout: 2_000, ...rest };
}

describe("freePort", () => {
  it("[TST-PW-12] returns a port that can be listened on, a different one each time it is held", async () => {
    const first = await freePort();
    expect(first).toBeGreaterThan(0);
    const holder = createServer();
    await new Promise<void>((resolve) => holder.listen(first, "127.0.0.1", resolve));
    try {
      expect(await freePort()).not.toBe(first);
    } finally {
      await new Promise((resolve) => holder.close(resolve));
    }
  });
});

describe("expandPlaceholders", () => {
  it("[TST-PW-13] replaces every {port}, {host} and {url}", () => {
    expect(
      expandPlaceholders("--listen={host}:{port} {url}/{port}", {
        port: 4100,
        host: "127.0.0.1",
        url: "http://127.0.0.1:4100",
      }),
    ).toBe("--listen=127.0.0.1:4100 http://127.0.0.1:4100/4100");
  });
});

describe("startApp", () => {
  it("[TST-PW-14] starts the command on a free port, waits until it answers, and stops it on SIGINT", async () => {
    const app = await startApp(serverOptions(SERVER, { env: { EXTRA: "{port}-{host}" } }));
    try {
      expect(app.url).toBe(`http://127.0.0.1:${app.port}`);
      const answer = (await (await fetch(`${app.url}/hello`)).json()) as Record<string, string>;
      expect(answer).toEqual({
        path: "/hello",
        port: String(app.port),
        host: "127.0.0.1",
        extra: `${app.port}-127.0.0.1`,
      });
    } finally {
      const ended = await app.stop();
      expect(ended.code).toBe(0);
    }
    await expect(fetch(`${app.url}/`)).rejects.toThrow();
  });

  it("[TST-PW-15] fills {port} into the arguments and uses distinct ports for parallel apps", async () => {
    const script = `require("node:http").createServer((q, r) => r.end("ok")).listen(Number(process.argv[1]), "127.0.0.1"); process.on("SIGINT", () => process.exit(0));`;
    const options: AppServerOptions = {
      command: process.execPath,
      args: ["-e", script, "{port}"],
      stopTimeout: 2_000,
    };
    const apps = await Promise.all([startApp(options), startApp(options)]);
    try {
      expect(new Set(apps.map((app) => app.port)).size).toBe(2);
      for (const app of apps) expect(await (await fetch(app.url)).text()).toBe("ok");
    } finally {
      await Promise.all(apps.map((app) => app.stop()));
    }
  });

  it("[TST-PW-16] kills a process that ignores SIGINT after stopTimeout", async () => {
    const app = await startApp(serverOptions(STUBBORN, { stopTimeout: 300 }));
    const started = Date.now();
    const ended = await app.stop();
    expect(Date.now() - started).toBeLessThan(5_000);
    // Windows has no SIGINT delivery: the first signal ends the process there.
    if (process.platform !== "win32") expect(ended.signal).toBe("SIGKILL");
    await expect(fetch(`${app.url}/`)).rejects.toThrow();
  });

  it("[TST-PW-17] returns the same promise when stop is called twice", async () => {
    const app = await startApp(serverOptions(SERVER));
    const first = app.stop();
    expect(app.stop()).toBe(first);
    await first;
  });

  it("[TST-PW-18] reports a process that ends before it answers, with its output", async () => {
    await expect(
      startApp({
        command: process.execPath,
        args: ["-e", 'console.error("cannot bind"); process.exit(3);'],
      }),
    ).rejects.toThrow(/ended before it answered[\s\S]*cannot bind/);
  });

  it("[TST-PW-19] reports a command that cannot be started", async () => {
    await expect(
      startApp({ command: "this-command-does-not-exist-shadowjs", startTimeout: 5_000 }),
    ).rejects.toThrow("could not start this-command-does-not-exist-shadowjs");
  });

  it("[TST-PW-20] stops a process that never answers once startTimeout passes", async () => {
    await expect(
      startApp({
        command: process.execPath,
        args: [
          "-e",
          'process.on("SIGINT", () => process.exit(0)); setInterval(() => {}, 1000); console.log("idle");',
        ],
        startTimeout: 400,
        stopTimeout: 1_000,
      }),
    ).rejects.toThrow(/did not answer on http:\/\/127\.0\.0\.1:\d+ within 400 ms:\nidle/);
  });

  it("[TST-PW-21] treats a 404 as an answer and a 500 as not ready yet", async () => {
    const script = `
      let calls = 0;
      require("node:http").createServer((q, r) => { r.statusCode = ++calls < 3 ? 500 : 404; r.end(); }).listen(Number(process.env.PORT), process.env.HOST);
      process.on("SIGINT", () => process.exit(0));`;
    const app = await startApp(serverOptions(script));
    try {
      expect((await fetch(app.url)).status).toBe(404);
    } finally {
      await app.stop();
    }
  });
});

describe("createTest", () => {
  /** What `extend` of a Playwright test receives, and what a fixture function is called with. */
  type Definition = unknown;
  interface Captured {
    definitions: Record<string, Definition>;
  }

  /** A base test that records the fixtures it is extended with and returns itself. */
  function fakeBase(captured: Captured): PlaywrightTestBase {
    return {
      extend(fixtures: never): unknown {
        captured.definitions = fixtures as Record<string, Definition>;
        return "extended";
      },
    };
  }

  function fixtureFunction(captured: Captured, name: string): (...args: never[]) => Promise<void> {
    const entry = captured.definitions[name];
    const fn = Array.isArray(entry) ? entry[0] : entry;
    return fn as (...args: never[]) => Promise<void>;
  }

  function options(captured: Captured, name: string): Record<string, unknown> {
    const entry = captured.definitions[name];
    return Array.isArray(entry) ? (entry[1] as Record<string, unknown>) : {};
  }

  it("[TST-PW-22] extends the base test with the app, baseURL, problems and hydrated fixtures", () => {
    const captured: Captured = { definitions: {} };
    expect(createTest(fakeBase(captured))).toBe("extended");
    expect(Object.keys(captured.definitions).sort()).toEqual([
      "app",
      "appServer",
      "baseURL",
      "hydrated",
      "problems",
      "problemsOptions",
    ]);
    expect(options(captured, "app")).toMatchObject({ scope: "worker" });
    expect(options(captured, "appServer")).toMatchObject({ option: true, scope: "worker" });
    expect(options(captured, "problems")).toMatchObject({ auto: true });
  });

  it("[TST-PW-23] the app fixture starts the server, provides baseURL, and stops it after use", async () => {
    const captured: Captured = { definitions: {} };
    createTest(fakeBase(captured));
    let app: RunningApp | undefined;
    let base: string | undefined;
    const appFixture = fixtureFunction(captured, "app") as unknown as (
      deps: { appServer: AppServerOptions },
      use: (value: RunningApp) => Promise<void>,
    ) => Promise<void>;
    const baseUrlFixture = fixtureFunction(captured, "baseURL") as unknown as (
      deps: { app: RunningApp },
      use: (value: string) => Promise<void>,
    ) => Promise<void>;
    await appFixture({ appServer: serverOptions(SERVER) }, async (value) => {
      app = value;
      expect((await fetch(`${value.url}/x`)).status).toBe(200);
      await baseUrlFixture({ app: value }, async (url) => {
        base = url;
      });
    });
    expect(base).toBe(app?.url);
    await expect(fetch(`${app?.url}/`)).rejects.toThrow();
  });

  it("[TST-PW-24] the app fixture says how to configure the server when appServer is missing", async () => {
    const captured: Captured = { definitions: {} };
    createTest(fakeBase(captured));
    const appFixture = fixtureFunction(captured, "app") as unknown as (
      deps: { appServer: undefined },
      use: () => Promise<void>,
    ) => Promise<void>;
    await expect(appFixture({ appServer: undefined }, async () => undefined)).rejects.toThrow(
      "set the appServer option",
    );
  });

  it("[TST-PW-25] the problems fixture fails the test at its end and always stops listening", async () => {
    const captured: Captured = { definitions: {} };
    createTest(fakeBase(captured));
    const problemsFixture = fixtureFunction(captured, "problems") as unknown as (
      deps: { page: ReturnType<typeof fakePage>["page"]; problemsOptions: object },
      use: (value: unknown) => Promise<void>,
    ) => Promise<void>;

    const clean = fakePage();
    await problemsFixture({ page: clean.page, problemsOptions: {} }, async () => undefined);
    expect(clean.events.eventNames()).toEqual([]);

    const dirty = fakePage();
    await expect(
      problemsFixture({ page: dirty.page, problemsOptions: {} }, async () => {
        dirty.events.emit("pageerror", new Error("uncaught in the page"));
      }),
    ).rejects.toThrow("pageerror: uncaught in the page");
    expect(dirty.events.eventNames()).toEqual([]);

    const expected = fakePage();
    await problemsFixture(
      { page: expected.page, problemsOptions: { ignore: ["uncaught"] } },
      async () => {
        expected.events.emit("pageerror", new Error("uncaught in the page"));
      },
    );
  });

  it("[TST-PW-26] the hydrated fixture opens the path and waits for hydration", async () => {
    const captured: Captured = { definitions: {} };
    createTest(fakeBase(captured));
    const hydratedFixture = fixtureFunction(captured, "hydrated") as unknown as (
      deps: { page: object },
      use: (value: (path?: string, options?: { mark?: string }) => Promise<void>) => Promise<void>,
    ) => Promise<void>;
    const steps: string[] = [];
    const { page } = fakePage({
      waitForFunction: async (_fn, arg) => {
        steps.push(`wait ${String(arg)}`);
        return true;
      },
    });
    const withGoto = Object.assign(page, {
      goto: async (url: string) => {
        steps.push(`goto ${url}`);
      },
    });
    await hydratedFixture({ page: withGoto }, async (hydrated) => {
      await hydrated();
      await hydrated("/docs", { mark: "app:ready" });
    });
    expect(steps).toEqual(["goto /", "wait dusk:hydrated", "goto /docs", "wait app:ready"]);
  });
});
