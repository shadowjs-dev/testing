/**
 * `@shadow-js/testing`: DOM-agnostic test helpers. Nothing here touches the DOM, so it also works
 * for stores and hooks in a node test. DOM rendering lives in `@shadow-js/testing/dom`.
 * @packageDocumentation
 */

export { act } from "./internal/act";
export { type Deferred, deferred, type MockResource, mockResource } from "./internal/deferred";
export { flush } from "./internal/flush";
export { cleanup } from "./internal/registry";
export { type RenderHookOptions, type RenderHookResult, renderHook } from "./internal/render-hook";
export { type TestEffectOptions, testEffect } from "./internal/test-effect";
export { createTestRoot, type TestRoot } from "./internal/test-root";
export { type CapturedWarnings, captureWarnings } from "./internal/warnings";
