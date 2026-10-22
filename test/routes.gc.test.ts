import { defineRoute } from "@shadow-js/router";
import { describe, expect, it } from "vitest";
import { createRoutesStub } from "../src/routes";

/** The collector hook; the gc project always runs with --expose-gc. */
function exposedGc(): () => void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc === undefined) throw new Error("the gc project must run with --expose-gc");
  return gc;
}

/** Yields to the event loop: a WeakRef target made in this job stays alive until the job ends. */
function nextJob(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * Creates, navigates and disposes `count` stubs, keeping only a WeakRef to each router. It is a separate
 * function on purpose: a stub held in the frame of the test would stay reachable through a stale slot.
 */
async function churn(count: number): Promise<WeakRef<object>[]> {
  const routes = [
    defineRoute("/", { component: () => "home" }),
    defineRoute("/about", { component: () => "about" }),
  ];
  const refs: WeakRef<object>[] = [];
  for (let index = 0; index < count; index += 1) {
    const stub = createRoutesStub({ routes });
    await stub.router.ready();
    await stub.router.navigate("/about");
    refs.push(new WeakRef(stub.router));
    stub.dispose();
  }
  return refs;
}

describe("createRoutesStub memory", () => {
  it("[TST-G1] 300 stubs created, navigated and disposed: no router stays reachable", async () => {
    const gc = exposedGc();
    const refs = await churn(300);
    // Bounded collections, each after a yield: a collector under load may need a few passes, a leak never converges.
    let released = 0;
    for (let pass = 0; pass < 20 && released < refs.length; pass += 1) {
      await nextJob();
      gc();
      gc();
      released = refs.filter((ref) => ref.deref() === undefined).length;
    }
    expect(released).toBe(refs.length);
  });
});
