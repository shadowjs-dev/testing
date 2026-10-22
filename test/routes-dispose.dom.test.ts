/**
 * `createRoutesStub().dispose()` releases the router it built: its history listeners, its state and its
 * history. The memory history is captured through a mock, so the test can see what the stub left behind.
 */
import { defineRoute } from "@shadow-js/router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flush } from "../src/internal/flush";
import { cleanup } from "../src/internal/registry";
import { createRoutesStub } from "../src/routes";

type MemoryHistory = ReturnType<typeof import("@shadow-js/router").createMemoryHistory>;

const captured = vi.hoisted(() => ({
  histories: [] as MemoryHistory[],
  counts: [] as Array<() => number>,
}));

vi.mock("@shadow-js/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shadow-js/router")>();
  return {
    ...actual,
    createMemoryHistory: (options?: Parameters<typeof actual.createMemoryHistory>[0]) => {
      const history = actual.createMemoryHistory(options);
      captured.histories.push(history);
      // Counted before the router subscribes to it, so every listener it registers is seen.
      captured.counts.push(countListeners(history));
      return history;
    },
  };
});

/** Counts the history listeners that are still registered: what a disposed stub must not leave behind. */
function countListeners(history: MemoryHistory): () => number {
  let active = 0;
  const listen = history.listen;
  history.listen = (listener) => {
    active += 1;
    const off = listen(listener);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      active -= 1;
      off();
    };
  };
  return () => active;
}

function text(value: string): () => unknown {
  return () => {
    const element = document.createElement("p");
    element.textContent = value;
    return element;
  };
}

const routes = [
  defineRoute("/", { component: text("home") }),
  defineRoute("/about", { component: text("about") }),
];

/** Starts a stub and returns it with the listener count and the history it created. */
async function started(initialEntries?: string[]) {
  const before = captured.histories.length;
  const stub = createRoutesStub(
    initialEntries === undefined ? { routes } : { routes, initialEntries },
  );
  const history = captured.histories[before];
  const listeners = captured.counts[before];
  if (history === undefined || listeners === undefined) {
    throw new Error("the stub did not create a memory history");
  }
  await stub.router.ready();
  return { stub, history, listeners };
}

afterEach(() => {
  cleanup();
  captured.histories.length = 0;
  captured.counts.length = 0;
});

describe("createRoutesStub: dispose releases the router", () => {
  it("[TST-240] dispose leaves no history listener behind", async () => {
    const { stub, listeners } = await started();
    expect(listeners()).toBeGreaterThan(0);
    stub.dispose();
    expect(listeners()).toBe(0);
  });

  it("[TST-241] after dispose a change of the history does not move the router", async () => {
    const { stub, history } = await started(["/"]);
    stub.dispose();
    history.push("/about");
    await flush();
    expect(stub.router.state.location()?.pathname).toBe("/");
  });

  it("[TST-242] dispose destroys the memory history the stub created", async () => {
    const { stub, history } = await started();
    const destroy = vi.spyOn(history, "destroy");
    stub.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("[TST-243] cleanup() disposes a stub the test did not dispose", async () => {
    const { stub, history } = await started(["/"]);
    stub.mount(document.createElement("div"));
    cleanup();
    history.push("/about");
    await flush();
    expect(stub.router.state.location()?.pathname).toBe("/");
  });

  it("[TST-244] dispose is safe to call twice", async () => {
    const { stub, listeners } = await started();
    stub.dispose();
    stub.dispose();
    expect(listeners()).toBe(0);
  });
});
