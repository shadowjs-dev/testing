import {
  type BoundFunctions,
  type ByRoleMatcher,
  type ByRoleOptions,
  type queries as dtlQueries,
  getQueriesForElement,
  type Matcher,
  type MatcherOptions,
  type SelectorMatcherOptions,
  type waitForOptions,
} from "@testing-library/dom";
import { waitFor } from "./wait-for";

/**
 * Testing Library's queries bound to one element, before the `findBy*` family is replaced.
 * @see Queries
 * @since 1.0.0
 */
export type BoundQueries = BoundFunctions<typeof dtlQueries>;

type FindKey = Extract<keyof BoundQueries, `find${string}`>;

/**
 * The `findBy*` and `findAllBy*` queries. They poll with the flushing {@link waitFor}, so a
 * pending effect is applied before each attempt. The generic element type parameter of
 * Testing Library is not supported; the result is always an `HTMLElement` (or an array of them).
 * @since 1.0.0
 */
export interface FindQueries {
  /** Resolves with the one element that `getByText` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByText(
    id: Matcher,
    options?: SelectorMatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByText` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByText(
    id: Matcher,
    options?: SelectorMatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByLabelText` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByLabelText(
    id: Matcher,
    options?: SelectorMatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByLabelText` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByLabelText(
    id: Matcher,
    options?: SelectorMatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByRole` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByRole(
    role: ByRoleMatcher,
    options?: ByRoleOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByRole` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByRole(
    role: ByRoleMatcher,
    options?: ByRoleOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByPlaceholderText` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByPlaceholderText(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByPlaceholderText` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByPlaceholderText(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByAltText` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByAltText(id: Matcher, options?: MatcherOptions, wait?: waitForOptions): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByAltText` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByAltText(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByTitle` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByTitle(id: Matcher, options?: MatcherOptions, wait?: waitForOptions): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByTitle` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByTitle(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByDisplayValue` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByDisplayValue(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByDisplayValue` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByDisplayValue(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
  /** Resolves with the one element that `getByTestId` finds, polling until it is found or the time limit passes (1000 ms by default). */
  findByTestId(id: Matcher, options?: MatcherOptions, wait?: waitForOptions): Promise<HTMLElement>;
  /** Resolves with every element that `getAllByTestId` finds, polling until at least one is found or the time limit passes (1000 ms by default). */
  findAllByTestId(
    id: Matcher,
    options?: MatcherOptions,
    wait?: waitForOptions,
  ): Promise<HTMLElement[]>;
}

/** Every Testing Library query bound to an element, with flushing `findBy*` queries. @since 1.0.0 */
export type Queries = Omit<BoundQueries, FindKey> & FindQueries;

/**
 * Binds the Testing Library queries to `element` and replaces its `findBy*` family with versions
 * that flush effects between polls.
 *
 * @param element The element the queries search within.
 * @returns The bound queries.
 * @since 1.0.0
 */
export function bindQueries(element: HTMLElement): Queries {
  const bound = getQueriesForElement(element);
  const later = <T>(query: () => T, wait?: waitForOptions): Promise<T> =>
    waitFor(query, { ...wait, container: element });
  return {
    ...bound,
    findByText: (id, options, wait) => later(() => bound.getByText(id, options), wait),
    findAllByText: (id, options, wait) => later(() => bound.getAllByText(id, options), wait),
    findByLabelText: (id, options, wait) => later(() => bound.getByLabelText(id, options), wait),
    findAllByLabelText: (id, options, wait) =>
      later(() => bound.getAllByLabelText(id, options), wait),
    findByRole: (role, options, wait) => later(() => bound.getByRole(role, options), wait),
    findAllByRole: (role, options, wait) => later(() => bound.getAllByRole(role, options), wait),
    findByPlaceholderText: (id, options, wait) =>
      later(() => bound.getByPlaceholderText(id, options), wait),
    findAllByPlaceholderText: (id, options, wait) =>
      later(() => bound.getAllByPlaceholderText(id, options), wait),
    findByAltText: (id, options, wait) => later(() => bound.getByAltText(id, options), wait),
    findAllByAltText: (id, options, wait) => later(() => bound.getAllByAltText(id, options), wait),
    findByTitle: (id, options, wait) => later(() => bound.getByTitle(id, options), wait),
    findAllByTitle: (id, options, wait) => later(() => bound.getAllByTitle(id, options), wait),
    findByDisplayValue: (id, options, wait) =>
      later(() => bound.getByDisplayValue(id, options), wait),
    findAllByDisplayValue: (id, options, wait) =>
      later(() => bound.getAllByDisplayValue(id, options), wait),
    findByTestId: (id, options, wait) => later(() => bound.getByTestId(id, options), wait),
    findAllByTestId: (id, options, wait) => later(() => bound.getAllByTestId(id, options), wait),
  };
}

/**
 * Queries over the whole document body, like Testing Library's `screen`. Each access binds to the
 * current `document.body`, so it follows a test environment that replaces the document.
 *
 * @example
 * import { screen, userEvent } from "@shadow-js/testing/dom";
 *
 * userEvent.click(screen.getByRole("button", { name: "Save" }));
 * @see within
 * @since 1.0.0
 */
export const screen: Queries = new Proxy({} as Queries, {
  get(_target, property): unknown {
    const queries = bindQueries(document.body);
    return Reflect.get(queries, property);
  },
  has(_target, property): boolean {
    return property in bindQueries(document.body);
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(bindQueries(document.body));
  },
  getOwnPropertyDescriptor(_target, property): PropertyDescriptor | undefined {
    const queries = bindQueries(document.body);
    const descriptor = Reflect.getOwnPropertyDescriptor(queries, property);
    return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
  },
});
