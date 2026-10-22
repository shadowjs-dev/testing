import { describe, expect, it } from "vitest";
import "../src/auto-cleanup";
import { render } from "../src/dom";

// Importing the auto-cleanup entry registers afterEach(cleanup). The two tests run in order, so
// the second one proves the first test's render was unmounted without any explicit cleanup call.
describe("@shadow-js/testing/auto-cleanup", () => {
  it("[TST-78] a render made by one test is still mounted during that test", () => {
    render(() => "leftover");
    expect(document.body.childElementCount).toBe(1);
  });

  it("[TST-79] the next test starts with nothing mounted", () => {
    expect(document.body.childElementCount).toBe(0);
  });
});
