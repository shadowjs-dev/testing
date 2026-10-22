/**
 * `createRoutesStub` from `@shadow-js/testing/routes`: a router with a memory history that
 * renders a route component for a location, without a browser or a build.
 */
import { flushSync } from "@shadow-js/core";
import { defineRoute, useParams } from "@shadow-js/router";
import { describe, expect, it } from "vitest";
import { flush } from "../src/internal/flush";
import { createRoutesStub } from "../src/routes";

function text(value: string): () => unknown {
  return () => {
    const element = document.createElement("p");
    element.textContent = value;
    return element;
  };
}

describe("createRoutesStub", () => {
  it("[TST-230] renders the route of the initial location", async () => {
    const stub = createRoutesStub({
      routes: [
        defineRoute("/", { component: text("home") }),
        defineRoute("/about", { component: text("about") }),
      ],
      initialEntries: ["/about"],
    });
    await stub.router.ready();
    const container = document.createElement("div");
    document.body.append(container);
    stub.mount(container);
    flushSync();
    await flush();
    expect(container.textContent).toContain("about");
    stub.dispose();
    container.remove();
  });

  it("[TST-231] navigating changes the rendered route", async () => {
    const stub = createRoutesStub({
      routes: [
        defineRoute("/", { component: text("home") }),
        defineRoute("/about", { component: text("about") }),
      ],
    });
    await stub.router.ready();
    const container = document.createElement("div");
    document.body.append(container);
    stub.mount(container);
    flushSync();
    await stub.router.navigate("/about");
    await flush();
    expect(container.textContent).toContain("about");
    stub.dispose();
    container.remove();
  });

  it("[TST-232] path params reach the route component", async () => {
    const stub = createRoutesStub({
      routes: [
        defineRoute("/users/:id", {
          component: () => {
            const params = useParams<"/users/:id">();
            const element = document.createElement("p");
            element.textContent = `user ${params.id}`;
            return element;
          },
        }),
      ],
      initialEntries: ["/users/ada"],
    });
    await stub.router.ready();
    const container = document.createElement("div");
    document.body.append(container);
    stub.mount(container);
    flushSync();
    await flush();
    expect(container.textContent).toContain("user ada");
    stub.dispose();
    container.remove();
  });
});
