import type { Owner } from "@shadow-js/core";
import type { Router } from "@shadow-js/router";
import {
  act,
  captureWarnings,
  type cleanup,
  createTestRoot,
  deferred,
  type flush,
  mockResource,
  renderHook,
  testEffect,
} from "../src/index";
import { createRoutesStub, type RoutesStub } from "../src/routes";
import type { Equal, Expect } from "./support";

// act: returns whatever the callback returns.
const actNumber = act(() => 42);
type _ActNumber = Expect<Equal<typeof actNumber, number>>;

const actPromise = act(() => Promise.resolve("done"));
type _ActPromise = Expect<Equal<typeof actPromise, Promise<string>>>;

type _ActFlush = Expect<Equal<ReturnType<typeof flush>, Promise<void>>>;

// Negative: act keeps the callback's return type.
// @ts-expect-error act(() => 1) returns number, not string
const _actWrong: string = act(() => 1);

// deferred: promise carries the type argument; resolve accepts it.
const pending = deferred<string>();
type _DeferredPromise = Expect<Equal<typeof pending.promise, Promise<string>>>;

// Negative: resolve only accepts the declared type.
// @ts-expect-error resolve expects string
pending.resolve(1);

// mockResource: fetch resolves to the type argument; calls is a number.
const resource = mockResource<number>();
type _ResourceFetch = Expect<Equal<Awaited<ReturnType<typeof resource.fetch>>, number>>;
type _ResourceCalls = Expect<Equal<typeof resource.calls, number>>;

// Negative: resolve only accepts the declared type.
// @ts-expect-error resolve expects number
resource.resolve("one");

// Negative: calls is readonly.
// @ts-expect-error calls is readonly
resource.calls = 2;

// cleanup returns nothing.
type _CleanupVoid = Expect<Equal<ReturnType<typeof cleanup>, void>>;

// renderHook: result.current holds the hook's return value.
const hook = renderHook(() => ({ count: 0 }));
type _HookCurrent = Expect<Equal<typeof hook.result.current, { count: number }>>;
type _HookDispose = Expect<Equal<ReturnType<typeof hook.dispose>, void>>;
type _HookCleanup = Expect<Equal<ReturnType<typeof hook.cleanup>, void>>;
type _HookOwner = Expect<Equal<typeof hook.owner, Owner>>;

// Negative: result is readonly, so current cannot be replaced.
// @ts-expect-error result.current is readonly
hook.result.current = { count: 2 };

// Negative: wrapper must be a component-like function.
// @ts-expect-error wrapper must be a function
const _badWrapper = renderHook(() => 1, { wrapper: 5 });

// Negative: the hook argument is required.
// @ts-expect-error renderHook needs a hook function
const _noHook = renderHook();

// testEffect resolves once the effect calls done.
type _TestEffectPromise = Expect<Equal<ReturnType<typeof testEffect>, Promise<void>>>;

// Negative: timeoutMs must be a number.
// @ts-expect-error timeoutMs is a number
const _badTimeout = testEffect((done: () => void) => done(), { timeoutMs: "1" });

// Negative: setup receives a done callback, not a string.
// @ts-expect-error setup receives done: () => void
const _badSetup = testEffect((done: string) => done);

// createTestRoot exposes the setup result as value.
const root = createTestRoot(() => ({ n: 1 }));
type _RootValue = Expect<Equal<typeof root.value, { n: number }>>;
type _RootDispose = Expect<Equal<ReturnType<typeof root.dispose>, void>>;

// Negative: value is readonly.
// @ts-expect-error value is readonly
root.value = { n: 2 };

// captureWarnings returns the function result and the collected messages.
const warned = captureWarnings(() => "ok");
type _WarnedValue = Expect<Equal<typeof warned.value, string>>;
type _WarnedMessages = Expect<Equal<typeof warned.messages, readonly string[]>>;

// Negative: messages is a readonly array.
// @ts-expect-error messages is readonly
warned.messages.push("late");

// createRoutesStub builds a stub with a router, mount and dispose.
const stub = createRoutesStub({ routes: [] });
type _StubType = Expect<Equal<typeof stub, RoutesStub>>;
type _StubRouter = Expect<Equal<typeof stub.router, Router>>;
type _StubMount = Expect<Equal<ReturnType<typeof stub.mount>, HTMLElement>>;
type _StubDispose = Expect<Equal<ReturnType<typeof stub.dispose>, void>>;

// Negative: routes is required.
// @ts-expect-error routes is required
const _noRoutes = createRoutesStub({});

// Negative: initialEntries holds strings.
// @ts-expect-error initialEntries holds strings
const _badEntries = createRoutesStub({ routes: [], initialEntries: [1] });

// Negative: unknown option names are rejected.
// @ts-expect-error unknown option
const _extraOption = createRoutesStub({ routes: [], extra: true });
