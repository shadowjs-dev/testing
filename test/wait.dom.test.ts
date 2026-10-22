import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "../src/dom";
import { mockResource } from "../src/index";
import { load } from "./support/load";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const profileSource = `
import { useResource } from "@shadow-js/core";
export function Profile(props) {
  const user = useResource(() => props.load());
  return <p>{user.error ? "failed" : user.loading ? "loading" : user.latest}</p>;
}`;

const itemsSource = `
import { useResource } from "@shadow-js/core";
export function Items(props) {
  const items = useResource(() => props.load());
  return <ul>{(items.latest ?? []).map((item) => <li>{item}</li>)}</ul>;
}`;

describe("waitFor and findBy queries with resources", () => {
  it("[TST-56] waitFor resolves once a mocked resource settles and the DOM shows its value", async () => {
    const mod = await load<{ Profile: (props: { load: () => Promise<string> }) => unknown }>(
      profileSource,
    );
    const request = mockResource<string>();
    const view = render(() => mod.Profile({ load: request.fetch }));
    expect(view.container.textContent).toBe("loading");
    request.resolve("Ada");
    await waitFor(() => {
      expect(view.container.textContent).toBe("Ada");
    });
  });

  it("[TST-57] findByText resolves with the element once the resource has settled", async () => {
    const mod = await load<{ Profile: (props: { load: () => Promise<string> }) => unknown }>(
      profileSource,
    );
    const request = mockResource<string>();
    const view = render(() => mod.Profile({ load: request.fetch }));
    request.resolve("Grace");
    const found = await view.findByText("Grace");
    expect(found.tagName).toBe("P");
  });

  it("[TST-58] findByRole rejects with DTL's error when the element never appears, honoring the timeout option", async () => {
    const view = render(() => "static");
    await expect(view.findByRole("button", undefined, { timeout: 50 })).rejects.toThrow(
      /Unable to find role="button"/,
    );
  });

  it("[TST-59] findAllByRole waits for the list items and returns them in order", async () => {
    const mod = await load<{ Items: (props: { load: () => Promise<string[]> }) => unknown }>(
      itemsSource,
    );
    const request = mockResource<string[]>();
    const view = render(() => mod.Items({ load: request.fetch }));
    request.resolve(["a", "b"]);
    const found = await view.findAllByRole("listitem");
    expect(found.map((item) => item.textContent)).toEqual(["a", "b"]);
  });

  it("[TST-60] waitFor rejects when the callback keeps failing until the timeout", async () => {
    await expect(
      waitFor(
        () => {
          expect(1).toBe(2);
        },
        { timeout: 50 },
      ),
    ).rejects.toThrow();
  });

  it("[TST-61] waitFor resolves with the value the callback returned", async () => {
    await expect(waitFor(() => 7)).resolves.toBe(7);
  });

  it("[TST-62] mockResource counts calls and pending requests, and settles the oldest first", async () => {
    const request = mockResource<number>();
    expect(request.calls).toBe(0);
    const first = request.fetch();
    const second = request.fetch();
    expect(request.calls).toBe(2);
    expect(request.pending).toBe(2);
    request.resolve(1);
    expect(request.pending).toBe(1);
    await expect(first).resolves.toBe(1);
    const failure = expect(second).rejects.toThrow("network");
    request.reject(new Error("network"));
    await failure;
    expect(request.pending).toBe(0);
  });

  it("[TST-63] resolve() with nothing pending throws, so a test cannot settle a request that does not exist", () => {
    const request = mockResource<number>();
    expect(() => request.resolve(1)).toThrow(/no pending request/);
    expect(() => request.reject(new Error("x"))).toThrow(/no pending request/);
  });

  it("[TST-64] a rejected resource reaches the DOM as its error state, found by waitFor", async () => {
    const mod = await load<{ Profile: (props: { load: () => Promise<string> }) => unknown }>(
      profileSource,
    );
    const request = mockResource<string>();
    const view = render(() => mod.Profile({ load: request.fetch }));
    request.reject(new Error("offline"));
    await waitFor(() => {
      expect(view.container.textContent).toBe("failed");
    });
  });
});
