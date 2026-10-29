/**
 * The jest-dom style matchers as plain functions. They know nothing about vitest: the entry
 * `src/matchers.ts` registers them with `expect.extend`. Each returns `{ pass, message }`, the shape
 * vitest expects, and each one fails loudly (a `TypeError`) when it is given something that is not
 * a DOM node, rather than reporting a misleading failure.
 *
 * Nothing here loads `@testing-library/dom` (an optional peer): the accessible-name matchers that
 * need its role computation live in `accessible-matchers.ts`, which only the `dom` entry imports.
 * @packageDocumentation
 */
/**
 * The result a matcher returns: whether it passed, and the message vitest shows when it did not.
 * @since 1.0.0
 */
export interface MatcherResult {
  /** Whether the assertion holds. */
  readonly pass: boolean;
  /** Builds the failure message, for example `expected the element to be visible`. */
  readonly message: () => string;
}

/**
 * Options of `toHaveTextContent`.
 * @since 1.0.0
 */
export interface TextContentOptions {
  /**
   * Collapse runs of whitespace and trim the ends before comparing.
   * @default true
   */
  readonly normalizeWhitespace?: boolean;
}

/**
 * Options of `toHaveClass`.
 * @since 1.0.0
 */
export interface ClassOptions {
  /**
   * The element must have exactly the listed classes, no more and no fewer.
   * @default false
   */
  readonly exact?: boolean;
}

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * Tests `text` against `pattern` on a copy, so a `g` or `y` flag cannot carry a `lastIndex` from one call to the next (which
 * would make the same assertion pass and then fail).
 * @internal
 */
export function testPattern(pattern: RegExp, text: string): boolean {
  return new RegExp(pattern.source, pattern.flags).test(text);
}

/**
 * Splits CSS declarations at the `;` that end them, not at the ones inside quotes or parentheses (`url(data:...;base64,...)`),
 * and each declaration at its first `:`. A declaration that has no property or no value throws, as does an empty text: either
 * would compare nothing and pass.
 */
function parseDeclarations(text: string): [string, string][] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);
    if (quote !== "") {
      if (char === "\\") at += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")" && depth > 0) depth -= 1;
    else if (char === ";" && depth === 0) {
      parts.push(text.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(text.slice(start));
  const declarations: [string, string][] = [];
  for (const part of parts) {
    if (part.trim() === "") continue;
    const colon = part.indexOf(":");
    const property = colon === -1 ? "" : part.slice(0, colon).trim();
    const value = colon === -1 ? "" : part.slice(colon + 1).trim();
    if (property === "" || value === "")
      throw new TypeError(
        `toHaveStyle: "${part.trim()}" is not a CSS declaration ("property: value").`,
      );
    declarations.push([property, value]);
  }
  if (declarations.length === 0)
    throw new TypeError("toHaveStyle: the style text holds no declaration to compare.");
  return declarations;
}

/** Throws a `TypeError` unless `value` is a DOM node. @internal */
export function nodeOf(value: unknown, matcher: string): Element {
  if (value instanceof Element) return value;
  const received = value === null ? "null" : typeof value === "object" ? "object" : typeof value;
  throw new TypeError(`${matcher}: expected an element, received ${received}`);
}

/** Whether an element is one of the form controls the HTML disabled attribute applies to. */
const DISABLEABLE = new Set([
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "OPTGROUP",
  "OPTION",
  "FIELDSET",
]);

/** Whether a browser treats the element as disabled: its own attribute or a disabled fieldset around it. @internal */
export function isDisabled(element: Element): boolean {
  // Only a form control (or a custom element) can be disabled; a div inside a disabled fieldset is not.
  if (!DISABLEABLE.has(element.tagName) && !element.tagName.includes("-")) return false;
  if (DISABLEABLE.has(element.tagName) && element.hasAttribute("disabled")) return true;
  let child: Element = element;
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node.tagName === "FIELDSET" && node.hasAttribute("disabled")) {
      // The controls in the fieldset's first legend stay enabled, as in a browser.
      const legend = Array.from(node.children).find((entry) => entry.tagName === "LEGEND");
      if (legend === undefined || legend !== child) return true;
    }
    child = node;
  }
  return false;
}

function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  let previous: Element | null = null;
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden")) return false;
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style?.display === "none") return false;
    if (style?.visibility === "hidden" || style?.visibility === "collapse") return false;
    // As in jest-dom: a fully transparent element hides what it holds, and a closed <details> hides all but its summary.
    if (style?.opacity === "0") return false;
    if (
      previous !== null &&
      node.tagName === "DETAILS" &&
      previous.tagName !== "SUMMARY" &&
      !node.hasAttribute("open")
    )
      return false;
    previous = node;
  }
  return true;
}

const CHECKABLE_ROLES = new Set([
  "checkbox",
  "radio",
  "switch",
  "menuitemcheckbox",
  "menuitemradio",
]);

/** Converts `color` or `margin-top` from an object key such as `marginTop`. */
const kebab = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The jest-dom matchers, by name. */
export const matchers = {
  toBeInTheDocument(actual: unknown): MatcherResult {
    if (actual === null || actual === undefined) {
      return { pass: false, message: () => "expected an element, received nothing" };
    }
    const element = nodeOf(actual, "toBeInTheDocument");
    const pass = element.isConnected;
    return {
      pass,
      message: () => `expected the element ${pass ? "not " : ""}to be in the document`,
    };
  },

  toHaveTextContent(
    actual: unknown,
    expected: string | RegExp,
    options: TextContentOptions = {},
  ): MatcherResult {
    const element = nodeOf(actual, "toHaveTextContent");
    const raw = element.textContent ?? "";
    const text = options.normalizeWhitespace === false ? raw : normalize(raw);
    // "" is contained in every text, so it would always pass: it means "no text" here.
    const pass =
      typeof expected === "string"
        ? expected === ""
          ? text === ""
          : text.includes(expected)
        : testPattern(expected, text);
    return {
      pass,
      message: () =>
        `expected the text ${pass ? "not " : ""}to match ${String(expected)}; it is "${text}"`,
    };
  },

  toHaveAttribute(actual: unknown, name: string, value?: unknown): MatcherResult {
    const element = nodeOf(actual, "toHaveAttribute");
    const present = element.hasAttribute(name);
    const current = element.getAttribute(name);
    const pass = value === undefined ? present : present && current === String(value);
    return {
      pass,
      message: () =>
        value === undefined
          ? `expected the attribute ${name} ${pass ? "not " : ""}to be present`
          : `expected the attribute ${name} ${pass ? "not " : ""}to be "${String(value)}"; it is ${current === null ? "absent" : `"${current}"`}`,
    };
  },

  toBeVisible(actual: unknown): MatcherResult {
    const element = nodeOf(actual, "toBeVisible");
    const pass = isVisible(element);
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be visible` };
  },

  toBeDisabled(actual: unknown): MatcherResult {
    const element = nodeOf(actual, "toBeDisabled");
    const pass = isDisabled(element);
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be disabled` };
  },

  toBeEnabled(actual: unknown): MatcherResult {
    const element = nodeOf(actual, "toBeEnabled");
    const pass = !isDisabled(element);
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be enabled` };
  },

  toHaveValue(actual: unknown, expected?: unknown): MatcherResult {
    const element = nodeOf(actual, "toHaveValue");
    let value: string | string[] | number | null;
    if (element instanceof HTMLSelectElement && element.multiple) {
      value = Array.from(element.selectedOptions, (option) => option.value);
    } else if (element instanceof HTMLInputElement && element.type === "number") {
      value = element.value === "" ? null : Number(element.value);
    } else if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      value = element.value;
    } else {
      throw new TypeError("toHaveValue: expected an input, textarea or select");
    }
    const pass =
      expected === undefined
        ? value !== null && value !== ""
        : JSON.stringify(value) === JSON.stringify(expected);
    return {
      pass,
      message: () =>
        `expected the value ${pass ? "not " : ""}to be ${JSON.stringify(expected)}; it is ${JSON.stringify(value)}`,
    };
  },

  toHaveFocus(actual: unknown): MatcherResult {
    const element = nodeOf(actual, "toHaveFocus");
    const pass = element.ownerDocument.activeElement === element;
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to have focus` };
  },

  toBeChecked(actual: unknown): MatcherResult {
    const element = nodeOf(actual, "toBeChecked");
    let checked: boolean;
    if (
      element instanceof HTMLInputElement &&
      (element.type === "checkbox" || element.type === "radio")
    ) {
      checked = element.checked;
    } else if (CHECKABLE_ROLES.has(element.getAttribute("role") ?? "")) {
      checked = element.getAttribute("aria-checked") === "true";
    } else {
      throw new TypeError(
        "toBeChecked: expected a checkbox, a radio or an element with a checked role",
      );
    }
    return {
      pass: checked,
      message: () => `expected the element ${checked ? "not " : ""}to be checked`,
    };
  },

  toHaveClass(actual: unknown, ...args: unknown[]): MatcherResult {
    const element = nodeOf(actual, "toHaveClass");
    const last = args[args.length - 1];
    const options: ClassOptions =
      typeof last === "object" && last !== null && !Array.isArray(last)
        ? (last as ClassOptions)
        : {};
    const expected = (options === last ? args.slice(0, -1) : args).map(String);
    const actualClasses = Array.from(element.classList);
    const hasAll = expected.every((name) => element.classList.contains(name));
    const pass =
      options.exact === true ? hasAll && actualClasses.length === new Set(expected).size : hasAll;
    return {
      pass,
      message: () =>
        `expected the classes ${pass ? "not " : ""}to be ${expected.join(" ")}${options.exact === true ? " exactly" : ""}; they are "${actualClasses.join(" ")}"`,
    };
  },

  toHaveStyle(actual: unknown, expected: string | Record<string, string>): MatcherResult {
    const element = nodeOf(actual, "toHaveStyle");
    const view = element.ownerDocument.defaultView?.getComputedStyle(element);
    const wanted: [string, string][] =
      typeof expected === "string"
        ? parseDeclarations(expected)
        : Object.entries(expected).map(([key, value]) => [kebab(key), value]);
    const mismatches = wanted.filter(([property, value]) => {
      const inline = element instanceof HTMLElement ? element.style.getPropertyValue(property) : "";
      const current = view?.getPropertyValue(property) || inline;
      return normalize(current) !== normalize(value);
    });
    const pass = mismatches.length === 0;
    return {
      pass,
      message: () =>
        `expected the style ${pass ? "not " : ""}to match ${JSON.stringify(expected)}; differences: ${mismatches.map(([property]) => property).join(", ") || "none"}`,
    };
  },

  toContainElement(actual: unknown, expected: unknown): MatcherResult {
    const container = nodeOf(actual, "toContainElement");
    if (!(expected instanceof Element)) {
      throw new TypeError("toContainElement: expected an element to look for");
    }
    const pass = container.contains(expected);
    return {
      pass,
      message: () => `expected the element ${pass ? "not " : ""}to contain the other element`,
    };
  },
} as const;

/** The name of every matcher in {@link matchers}. */
export type MatcherName = keyof typeof matchers;
