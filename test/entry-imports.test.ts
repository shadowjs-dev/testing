/**
 * Pay-per-use invariants for the entries of `@shadow-js/testing`: `@testing-library/dom` is an
 * optional peer, so only the `dom` entry may reach it through its imports. Checked on the source
 * import graph (relative imports only), which is what a bundler follows.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "../src");
const DOM_LIB = "@testing-library/dom";

/** Every module reachable from `entry` through relative imports, as absolute paths. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*"(\.{1,2}\/[^"]+)"/g)) {
      const target = match[1];
      if (target === undefined) continue;
      const base = resolve(dirname(file), target);
      queue.push(base.endsWith(".ts") ? base : `${base}.ts`);
    }
  }
  return seen;
}

/** The modules of the graph that import the DOM library. */
function domImporters(entry: string): string[] {
  return [...reachable(join(SRC, entry))].filter((file) =>
    readFileSync(file, "utf8").includes(`from "${DOM_LIB}"`),
  );
}

describe("entry imports", () => {
  it("[TST-233] the root, matchers, routes, auto-cleanup and playwright entries never reach @testing-library/dom", () => {
    for (const entry of [
      "index.ts",
      "matchers.ts",
      "routes.ts",
      "auto-cleanup.ts",
      "playwright.ts",
    ]) {
      expect(domImporters(entry), entry).toEqual([]);
    }
  });

  it("[TST-234] the dom entry is the one that loads @testing-library/dom", () => {
    const importers = domImporters("dom.ts").map((file) => file.slice(SRC.length + 1));
    expect(importers).toContain("internal/render.ts");
    expect(importers).toContain("internal/accessible-matchers.ts");
  });

  it("[TST-PW-27] only the playwright entry reaches Node built-ins, and no entry imports Playwright", () => {
    const importsOf = (entry: string): string[] =>
      [...reachable(join(SRC, entry))].flatMap((file) =>
        [
          ...readFileSync(file, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .matchAll(/from\s+"([^".][^"]*)"/g),
        ].flatMap((match) => (match[1] === undefined ? [] : [match[1]])),
      );
    for (const entry of ["index.ts", "dom.ts", "matchers.ts", "routes.ts", "auto-cleanup.ts"]) {
      expect(
        importsOf(entry).filter((name) => name.startsWith("node:")),
        entry,
      ).toEqual([]);
    }
    const playwright = importsOf("playwright.ts");
    expect(playwright.filter((name) => name.includes("playwright"))).toEqual([]);
    expect(new Set(playwright)).toEqual(new Set(["node:child_process", "node:net"]));
  });
});
