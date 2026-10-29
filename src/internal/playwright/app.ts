import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";

/** Characters of the process output kept for error messages. */
const OUTPUT_LIMIT = 8_000;
/** Pause between two readiness probes, in milliseconds. */
const PROBE_INTERVAL = 100;

/**
 * How to start the application under test.
 * @since 1.0.0
 */
export interface AppServerOptions {
  /**
   * The executable. It is started without a shell, so give a real program. On Windows `npm` and `npx`
   * are `.cmd` files and cannot be started that way; use `process.execPath` with the script instead,
   * for example `command: process.execPath, args: ["node_modules/@shadow-js/dusk/dist/cli/index.js", "start"]`.
   */
  readonly command: string;
  /**
   * The arguments. `{port}`, `{host}` and `{url}` in an argument are replaced with the free port, the
   * host and the origin that were chosen.
   * @default []
   */
  readonly args?: readonly string[] | undefined;
  /**
   * The working directory.
   * @default The current directory.
   */
  readonly cwd?: string | undefined;
  /**
   * Extra environment variables, over the current ones. `PORT` and `HOST` are always set to the
   * chosen port and host. The same `{port}`, `{host}` and `{url}` replacements apply to the values.
   * @default {}
   */
  readonly env?: Readonly<Record<string, string>> | undefined;
  /**
   * The host the server listens on and the tests connect to.
   * @default "127.0.0.1"
   */
  readonly host?: string | undefined;
  /**
   * The path that is requested to find out whether the server answers. Any answer below status 500
   * counts as ready.
   * @default "/"
   */
  readonly readyPath?: string | undefined;
  /**
   * Proves that the answer comes from the app and not from another process that took the port: the body of the
   * answer to `readyPath` must contain this text, or match this pattern (a health path or a page that serves a
   * known token). Without it, any answer below status 500 counts as ready.
   * @default undefined
   */
  readonly readyMatch?: string | RegExp | undefined;
  /**
   * How long to wait for the first answer, in milliseconds.
   * @default 60000
   */
  readonly startTimeout?: number | undefined;
  /**
   * How long the process may take to end after `SIGINT`, in milliseconds, before it is killed with `SIGKILL`.
   * @default 5000
   */
  readonly stopTimeout?: number | undefined;
}

/**
 * A running application started by {@link startApp}.
 * @since 1.0.0
 */
export interface RunningApp {
  /** The origin the server answers on, such as `http://127.0.0.1:41233`, without a trailing slash. */
  readonly url: string;
  /** The port that was chosen. */
  readonly port: number;
  /** What the process wrote to stdout and stderr so far (the last 8000 characters). */
  output(): string;
  /**
   * Stops the process: `SIGINT`, then `SIGKILL` after `stopTimeout`. Resolves when it has ended.
   * Calling it again returns the same promise.
   * @returns How the process ended.
   */
  stop(): Promise<{ readonly signal: NodeJS.Signals | null; readonly code: number | null }>;
}

/** Ports {@link freePort} already returned in this process (a test run uses a few hundred at most, so the set has no cap). */
const handedOut = new Set<number>();
/** Lowest port {@link freePort} tries: below the ephemeral range of Linux (32768) and macOS (49152). */
const PORT_MIN = 20_000;
/** Number of ports from {@link PORT_MIN} that {@link freePort} picks from. */
const PORT_SPAN = 25_000;
/** Attempts before {@link freePort} gives up, so the search always ends. */
const PORT_ATTEMPTS = 64;

/**
 * Tries to listen on `port` and closes again.
 * @returns True when it listened, false when the port is taken or not allowed.
 * @throws The listen error when the problem is the host (it cannot be bound at all), which no other port would fix.
 */
function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
      else reject(error);
    });
    probe.listen(port, host, () => {
      probe.close((error) => (error === undefined ? resolve(true) : reject(error)));
    });
  });
}

/**
 * Finds a TCP port that nobody listens on at the moment. A random port from 20000 up to (not including) 45000 is
 * probed with a listen on `host` and closed again; it is never the same port twice in one process. Port 0 is not
 * used because the system hands out the next ephemeral port, the pool every outbound socket draws from, so a parallel
 * test or connection often took it before the server started. Another process could still take the port before the
 * caller uses it; the window is a few milliseconds, and no port is fixed in advance.
 *
 * @param host The interface to probe; the port must be free there.
 * @returns The port.
 * @throws Error when the interface cannot be listened on (the promise rejects with the listen error), or when no
 * free port was found in 64 attempts.
 * @example
 * import { freePort } from "@shadow-js/testing/playwright";
 *
 * const port = await freePort();
 * @since 1.0.0
 */
export async function freePort(host = "127.0.0.1"): Promise<number> {
  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
    const port = PORT_MIN + Math.floor(Math.random() * PORT_SPAN);
    if (handedOut.has(port)) continue;
    if (await canListen(port, host)) {
      handedOut.add(port);
      return port;
    }
  }
  throw new Error(
    `freePort: no free port found in ${PORT_ATTEMPTS} attempts between ${PORT_MIN} and ${PORT_MIN + PORT_SPAN - 1}`,
  );
}

/**
 * Replaces `{port}`, `{host}` and `{url}` in a text.
 * @param text The text with placeholders.
 * @param values The values to put in.
 * @returns The text with every placeholder replaced.
 */
export function expandPlaceholders(
  text: string,
  values: { readonly port: number; readonly host: string; readonly url: string },
): string {
  return text
    .replaceAll("{port}", String(values.port))
    .replaceAll("{host}", values.host)
    .replaceAll("{url}", values.url);
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asks the server once. Any answer below status 500 means it is serving; with `match`, the body must also contain the
 * text or match the pattern, because the answer must come from the app itself.
 */
async function answers(url: string, match: string | RegExp | undefined): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: "manual" });
    if (match === undefined) {
      await response.body?.cancel();
      return response.status < 500;
    }
    const body = await response.text();
    if (response.status >= 500) return false;
    return typeof match === "string" ? body.includes(match) : new RegExp(match).test(body);
  } catch {
    return false;
  }
}

/**
 * Starts a server process on a free port and waits until it answers.
 *
 * The process is started without a shell, with `PORT` and `HOST` in its environment and the
 * placeholders of `args` filled in. If it ends first, or does not answer within `startTimeout`, it is
 * stopped and the error carries its output.
 *
 * @param options The command and how to reach it. See {@link AppServerOptions}.
 * @returns The running app, with `url` and `stop()`.
 * @throws Error when the process cannot be started, ends before it answers, or does not answer in time.
 * @example
 * import { startApp } from "@shadow-js/testing/playwright";
 *
 * const app = await startApp({
 *   command: process.execPath,
 *   args: ["node_modules/@shadow-js/dusk/dist/cli/index.js", "start", "--port", "{port}"],
 * });
 * try {
 *   const response = await fetch(`${app.url}/`);
 *   console.log(response.status);
 * } finally {
 *   await app.stop();
 * }
 * @see AppServerOptions
 * @since 1.0.0
 */
export async function startApp(options: AppServerOptions): Promise<RunningApp> {
  const host = options.host ?? "127.0.0.1";
  const startTimeout = options.startTimeout ?? 60_000;
  const stopTimeout = options.stopTimeout ?? 5_000;
  const port = await freePort(host);
  const url = `http://${host}:${port}`;
  const values = { port, host, url };

  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const [name, value] of Object.entries(options.env ?? {})) {
    environment[name] = expandPlaceholders(value, values);
  }
  environment["PORT"] = String(port);
  environment["HOST"] = host;

  const child: ChildProcess = spawn(
    options.command,
    (options.args ?? []).map((arg) => expandPlaceholders(arg, values)),
    {
      cwd: options.cwd,
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  const collect = (chunk: string): void => {
    output = (output + chunk).slice(-OUTPUT_LIMIT);
  };
  child.stdout?.setEncoding("utf8").on("data", collect);
  child.stderr?.setEncoding("utf8").on("data", collect);

  let ended = false;
  let spawnError: Error | undefined;
  const exited = new Promise<{ signal: NodeJS.Signals | null; code: number | null }>((resolve) => {
    // `close`, not `exit`: the output streams have been read to the end.
    child.once("close", (code, signal) => {
      ended = true;
      resolve({ code, signal });
    });
    child.once("error", (error) => {
      spawnError = error;
      ended = true;
      resolve({ code: null, signal: null });
    });
  });

  let stopping: ReturnType<RunningApp["stop"]> | undefined;
  const stop: RunningApp["stop"] = () => {
    stopping ??= (async () => {
      if (ended) return exited;
      child.kill("SIGINT");
      const timer = setTimeout(() => child.kill("SIGKILL"), stopTimeout);
      try {
        return await exited;
      } finally {
        clearTimeout(timer);
      }
    })();
    return stopping;
  };

  const target = new URL(options.readyPath ?? "/", url).href;
  const deadline = Date.now() + startTimeout;
  for (;;) {
    if (spawnError !== undefined) {
      throw new Error(`could not start ${options.command}: ${spawnError.message}`, {
        cause: spawnError,
      });
    }
    if (ended) {
      throw new Error(`${options.command} ended before it answered on ${url}:\n${output}`);
    }
    if (await answers(target, options.readyMatch)) {
      // The process may have ended while the probe was in flight (it lost the port): an answer is then not its own.
      if (ended) {
        throw new Error(`${options.command} ended before it answered on ${url}:\n${output}`);
      }
      break;
    }
    if (Date.now() >= deadline) {
      await stop();
      throw new Error(
        `${options.command} did not answer ${options.readyMatch === undefined ? "" : "as the app "}on ${url} within ${startTimeout} ms:\n${output}`,
      );
    }
    await pause(PROBE_INTERVAL);
  }

  return { url, port, output: () => output, stop };
}
