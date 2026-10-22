import { flushSync } from "@shadow-js/core";
import { fireEvent as dtlFireEvent } from "@testing-library/dom";

/** Node or window an event is dispatched on. @since 1.0.0 */
export type FireTarget = Document | Element | Window | Node;

/** Event init dictionary, plus `target` overrides (such as `{ target: { value: "x" } }`). @since 1.0.0 */
export type FireInit = Record<string, unknown>;

/**
 * One named event helper, for example `fireEvent.click`.
 * @param element The node to dispatch the event on.
 * @param init The event init, plus `target` overrides such as `{ target: { value: "x" } }`. Default: none.
 * @returns `false` when a listener canceled the event, otherwise `true`.
 * @since 1.0.0
 */
export type FireMethod = (element: FireTarget, init?: FireInit) => boolean;

/**
 * Event helpers that dispatch a real, bubbling event and then flush effects, so the DOM is current
 * when the call returns. Each returns `false` when a listener canceled the event.
 * @since 1.0.0
 */
export interface FireEventMethods {
  /** Dispatches a `click` event, then flushes effects. */
  click: FireMethod;
  /** Dispatches a `dblclick` event, then flushes effects. */
  dblClick: FireMethod;
  /** Dispatches a `contextmenu` event, then flushes effects. */
  contextMenu: FireMethod;
  /** Dispatches a `input` event, then flushes effects. */
  input: FireMethod;
  /** Dispatches a `change` event, then flushes effects. */
  change: FireMethod;
  /** Dispatches a `submit` event, then flushes effects. */
  submit: FireMethod;
  /** Dispatches a `reset` event, then flushes effects. */
  reset: FireMethod;
  /** Dispatches `focus`, then `focusin`, then flushes effects. */
  focus: FireMethod;
  /** Dispatches `blur`, then `focusout`, then flushes effects. */
  blur: FireMethod;
  /** Dispatches a `focusin` event, then flushes effects. */
  focusIn: FireMethod;
  /** Dispatches a `focusout` event, then flushes effects. */
  focusOut: FireMethod;
  /** Dispatches a `keydown` event, then flushes effects. */
  keyDown: FireMethod;
  /** Dispatches a `keyup` event, then flushes effects. */
  keyUp: FireMethod;
  /** Dispatches a `keypress` event, then flushes effects. */
  keyPress: FireMethod;
  /** Dispatches a `mousedown` event, then flushes effects. */
  mouseDown: FireMethod;
  /** Dispatches a `mouseup` event, then flushes effects. */
  mouseUp: FireMethod;
  /** Dispatches a `mousemove` event, then flushes effects. */
  mouseMove: FireMethod;
  /** Dispatches a `mouseenter` event, then flushes effects. */
  mouseEnter: FireMethod;
  /** Dispatches a `mouseleave` event, then flushes effects. */
  mouseLeave: FireMethod;
  /** Dispatches a `mouseover` event, then flushes effects. */
  mouseOver: FireMethod;
  /** Dispatches a `mouseout` event, then flushes effects. */
  mouseOut: FireMethod;
  /** Dispatches a `pointerdown` event, then flushes effects. */
  pointerDown: FireMethod;
  /** Dispatches a `pointerup` event, then flushes effects. */
  pointerUp: FireMethod;
  /** Dispatches a `pointermove` event, then flushes effects. */
  pointerMove: FireMethod;
  /** Dispatches a `pointerenter` event, then flushes effects. */
  pointerEnter: FireMethod;
  /** Dispatches a `pointerleave` event, then flushes effects. */
  pointerLeave: FireMethod;
  /** Dispatches a `touchstart` event, then flushes effects. */
  touchStart: FireMethod;
  /** Dispatches a `touchend` event, then flushes effects. */
  touchEnd: FireMethod;
  /** Dispatches a `touchmove` event, then flushes effects. */
  touchMove: FireMethod;
  /** Dispatches a `select` event, then flushes effects. */
  select: FireMethod;
  /** Dispatches a `scroll` event, then flushes effects. */
  scroll: FireMethod;
  /** Dispatches a `wheel` event, then flushes effects. */
  wheel: FireMethod;
  /** Dispatches a `dragstart` event, then flushes effects. */
  dragStart: FireMethod;
  /** Dispatches a `dragenter` event, then flushes effects. */
  dragEnter: FireMethod;
  /** Dispatches a `dragover` event, then flushes effects. */
  dragOver: FireMethod;
  /** Dispatches a `dragleave` event, then flushes effects. */
  dragLeave: FireMethod;
  /** Dispatches a `drop` event, then flushes effects. */
  drop: FireMethod;
  /** Dispatches a `copy` event, then flushes effects. */
  copy: FireMethod;
  /** Dispatches a `cut` event, then flushes effects. */
  cut: FireMethod;
  /** Dispatches a `paste` event, then flushes effects. */
  paste: FireMethod;
  /** Dispatches a `compositionstart` event, then flushes effects. */
  compositionStart: FireMethod;
  /** Dispatches a `compositionupdate` event, then flushes effects. */
  compositionUpdate: FireMethod;
  /** Dispatches a `compositionend` event, then flushes effects. */
  compositionEnd: FireMethod;
}

/** `fireEvent(element, event)` plus one helper per event type. @since 1.0.0 */
export type FireEvent = ((element: FireTarget, event: Event) => boolean) & FireEventMethods;

/**
 * The browser fires `focusout` (which bubbles) after `blur`, and `focusin` after `focus`. React's `onBlur`
 * and `onFocus` are those bubbling events, so the `blur` and `focus` helpers fire both, as Testing Library
 * does for React. The return value is the native event's.
 */
function withFocusPair(native: FireMethod, bubbling: FireMethod): FireMethod {
  return (element, init) => {
    const dispatched = native(element, init);
    bubbling(element, init);
    return dispatched;
  };
}

function flushed<A extends unknown[]>(fire: (...args: A) => boolean): (...args: A) => boolean {
  return (...args) => {
    const dispatched = fire(...args);
    flushSync();
    return dispatched;
  };
}

/**
 * Dispatches a DOM event on an element (or a window or document) and flushes ShadowJS effects before
 * it returns, so the DOM is current when the call returns. Each helper (`fireEvent.click`, and so on)
 * is the same call for one event type. Use it for a single event; use {@link userEvent} to act the
 * way a user does.
 *
 * @example
 * import { fireEvent } from "@shadow-js/testing/dom";
 * import { expect, it } from "vitest";
 *
 * it("passes the typed value on", () => {
 *   const field = document.createElement("input");
 *   document.body.append(field);
 *   fireEvent.input(field, { target: { value: "Ada" } });
 *   expect(field.value).toBe("Ada");
 * });
 * @see userEvent
 * @since 1.0.0
 */
export const fireEvent: FireEvent = Object.assign(flushed(dtlFireEvent), {
  click: flushed(dtlFireEvent.click),
  dblClick: flushed(dtlFireEvent.dblClick),
  contextMenu: flushed(dtlFireEvent.contextMenu),
  input: flushed(dtlFireEvent.input),
  change: flushed(dtlFireEvent.change),
  submit: flushed(dtlFireEvent.submit),
  reset: flushed(dtlFireEvent.reset),
  focus: flushed(withFocusPair(dtlFireEvent.focus, dtlFireEvent.focusIn)),
  blur: flushed(withFocusPair(dtlFireEvent.blur, dtlFireEvent.focusOut)),
  focusIn: flushed(dtlFireEvent.focusIn),
  focusOut: flushed(dtlFireEvent.focusOut),
  keyDown: flushed(dtlFireEvent.keyDown),
  keyUp: flushed(dtlFireEvent.keyUp),
  keyPress: flushed(dtlFireEvent.keyPress),
  mouseDown: flushed(dtlFireEvent.mouseDown),
  mouseUp: flushed(dtlFireEvent.mouseUp),
  mouseMove: flushed(dtlFireEvent.mouseMove),
  mouseEnter: flushed(dtlFireEvent.mouseEnter),
  mouseLeave: flushed(dtlFireEvent.mouseLeave),
  mouseOver: flushed(dtlFireEvent.mouseOver),
  mouseOut: flushed(dtlFireEvent.mouseOut),
  pointerDown: flushed(dtlFireEvent.pointerDown),
  pointerUp: flushed(dtlFireEvent.pointerUp),
  pointerMove: flushed(dtlFireEvent.pointerMove),
  pointerEnter: flushed(dtlFireEvent.pointerEnter),
  pointerLeave: flushed(dtlFireEvent.pointerLeave),
  touchStart: flushed(dtlFireEvent.touchStart),
  touchEnd: flushed(dtlFireEvent.touchEnd),
  touchMove: flushed(dtlFireEvent.touchMove),
  select: flushed(dtlFireEvent.select),
  scroll: flushed(dtlFireEvent.scroll),
  wheel: flushed(dtlFireEvent.wheel),
  dragStart: flushed(dtlFireEvent.dragStart),
  dragEnter: flushed(dtlFireEvent.dragEnter),
  dragOver: flushed(dtlFireEvent.dragOver),
  dragLeave: flushed(dtlFireEvent.dragLeave),
  drop: flushed(dtlFireEvent.drop),
  copy: flushed(dtlFireEvent.copy),
  cut: flushed(dtlFireEvent.cut),
  paste: flushed(dtlFireEvent.paste),
  compositionStart: flushed(dtlFireEvent.compositionStart),
  compositionUpdate: flushed(dtlFireEvent.compositionUpdate),
  compositionEnd: flushed(dtlFireEvent.compositionEnd),
});
