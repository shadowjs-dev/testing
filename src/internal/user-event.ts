import { flushSync } from "@shadow-js/core";
import { isDisabled } from "./matchers";

/** Selector for elements that can take keyboard focus, before the disabled and tabindex checks. */
const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';

/**
 * One step of {@link UserEvent.pointer}: move the pointer, press or release buttons, or both.
 * @see UserEvent.pointer
 * @since 1.0.0
 */
export interface PointerStep {
  /**
   * The element the pointer moves to for this step.
   * @default No default: when omitted, the pointer stays where the previous step left it.
   */
  readonly target?: Element;
  /**
   * Button tokens. `[MouseLeft]` presses and releases (down, up, click); `[MouseLeft>]` only presses;
   * `[/MouseLeft]` releases a button an earlier `>` step pressed. `[MouseRight]` and `[MouseMiddle]`
   * work the same way, and `[TouchA]` is a touch tap (pointer events of type `touch`, then click).
   * `[TouchA>]` and `[/TouchA]` split a tap.
   * @default No default: when omitted, the step only moves the pointer.
   */
  readonly keys?: string;
}

/** A text field that `type` and `clear` can edit. */
type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Options of {@link UserEvent.tab}. Every member is optional.
 * @see UserEvent.tab
 * @since 1.0.0
 */
export interface TabOptions {
  /**
   * Move backwards, as Shift+Tab does.
   * @default false
   */
  readonly shift?: boolean;
}

/**
 * The methods of {@link userEvent}: synchronous, simplified user interactions. Each call dispatches
 * the events a browser would, checks whether a canceled event stops the default action, and flushes
 * ShadowJS effects before it returns.
 * @see userEvent
 * @see fireEvent
 * @since 1.0.0
 */
export interface UserEvent {
  /**
   * Focuses a text field and types each character: keydown, then (unless the keydown was canceled)
   * a cancelable beforeinput, the value update and an input event, then keyup. Effects are flushed after each
   * character. Text past
   * the field's `maxlength` is dropped, as a browser drops it.
   * A disabled field (or one in a disabled fieldset) receives nothing; a read-only one gets the key
   * events but keeps its value, as in a browser.
   * @throws {TypeError} When `element` is not an `input` or `textarea`.
   */
  type(element: Element, text: string): void;
  /**
   * Focuses a text field, empties it, and dispatches an input event of type `deleteContentBackward`.
   * A disabled or read-only field is left as it is, with no event.
   * @throws {TypeError} When `element` is not an `input` or `textarea`.
   */
  clear(element: Element): void;
  /**
   * Pointer down, mouse down, focus, pointer up, mouse up, then click. A disabled form control, or one
   * inside a disabled fieldset (except in its first legend), receives none of these events.
   */
  click(element: Element): void;
  /**
   * Moves focus to the next focusable element in document order, or to the previous one with `shift`,
   * wrapping around at the ends. Disabled elements, `tabindex="-1"` ones, and anything hidden (`hidden`,
   * `display: none`, `visibility: hidden`) or inert is skipped. A keydown for Tab goes to the focused element first; a canceled
   * keydown keeps focus where it is. Without options, focus moves forward (`shift` defaults to false).
   */
  tab(options?: TabOptions): void;
  /**
   * Types into the focused element. `{Enter}`, `{Escape}`, `{Backspace}`, `{Delete}`, `{Tab}`,
   * `{Space}`, `{ArrowUp}`, `{ArrowDown}`, `{ArrowLeft}`, `{ArrowRight}`, `{Home}` and `{End}` press
   * that key; `{Shift}`, `{Control}`, `{Alt}` and `{Meta}` hold a modifier for the keys after them
   * (`{/Shift}` releases it); `{{` and `[[` are literal braces and brackets. As in a browser, text stops
   * at `maxlength` and goes only into controls that take text; Enter in a textarea breaks the line, and Enter
   * in a text field of a form clicks the form's default submit button (or submits a form that has a single text
   * field and no button); Enter clicks a button or a summary, and Space also toggles a checkbox or selects a radio.
   * @throws {SyntaxError} For an unclosed `{`, an unknown `{Name}`, or a `{/Name}` that is not a modifier.
   */
  keyboard(text: string): void;
  /** Dispatches the pointer and mouse enter, over and move events on the element. Pair it with `unhover`. */
  hover(element: Element): void;
  /** Dispatches the move, then the pointer and mouse leave and out events on the element. */
  unhover(element: Element): void;
  /** Two clicks, then a `dblclick` event. */
  dblClick(element: Element): void;
  /**
   * Selects, for each entry of `values`, the first option whose value or text equals it, then
   * dispatches input and change. In a single select the last entry wins. A disabled option (or one in
   * a disabled optgroup) is skipped, and a disabled select, or one with nothing left to select, gets no event.
   * @throws {TypeError} When `element` is not a `select`.
   * @throws {Error} When an entry matches no option.
   */
  selectOptions(element: Element, values: string | readonly string[]): void;
  /**
   * Runs scripted pointer input. Each step may move the pointer to `target` and press or release
   * buttons with `keys` (see {@link PointerStep}). The button state is kept for the whole call.
   * @throws {Error} When a step presses a button before any step has set a target.
   * @throws {SyntaxError} When a `keys` token is not a known button.
   */
  pointer(steps: PointerStep | readonly PointerStep[]): void;
  /**
   * Returns this object, so code written for `userEvent.setup()` in Testing Library works unchanged.
   */
  setup(): UserEvent;
}

function isTextField(element: Element): element is TextField {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function requireTextField(element: Element, method: string): TextField {
  if (!isTextField(element)) {
    throw new TypeError(`userEvent.${method}() needs an input or textarea element.`);
  }
  return element;
}

/**
 * What a field shows while its `value` is sanitized: a number input reports `""` for the "-" a user has
 * typed so far, and typing "5" next must give "-5", not "5". The text typed so far is remembered with the
 * value the field reported for it, so an edit made by anything else (a script, `clear`) is told apart.
 */
const typedText = new WeakMap<TextField, { readonly raw: string; readonly shown: string }>();

function currentText(field: TextField): string {
  const known = typedText.get(field);
  return known !== undefined && known.shown === field.value ? known.raw : field.value;
}

function setText(field: TextField, text: string): void {
  field.value = text;
  typedText.set(field, { raw: text, shown: field.value });
}

/**
 * Whether typing one more character changes the value: a browser refuses text past `maxlength`
 * (counted in UTF-16 units, as `value.length` is) and fires no input event for it.
 */
function hasRoom(field: TextField): boolean {
  return field.maxLength < 0 || currentText(field).length < field.maxLength;
}

/**
 * One edit as a browser makes it: a cancelable `beforeinput`, then (unless it was canceled) the new text and
 * an `input` event. Nothing happens, and no event fires, when there is nothing to delete.
 */
function edit(field: TextField, next: string, data: string | null, inputType: string): void {
  if (next === currentText(field) && inputType === "deleteContentBackward") return;
  const proceed = field.dispatchEvent(
    new InputEvent("beforeinput", {
      data,
      inputType,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
  if (!proceed) return;
  setText(field, next);
  dispatchInput(field, data, inputType);
}

function dispatchInput(element: TextField, data: string | null, inputType: string): void {
  element.dispatchEvent(
    new InputEvent("input", { data, inputType, bubbles: true, composed: true }),
  );
}

function type(element: Element, text: string): void {
  const field = requireTextField(element, "type");
  if (isDisabled(field)) return;
  field.focus();
  for (const character of text) {
    const allowed = field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: character,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    // A keydown that calls preventDefault stops the character from being inserted.
    if (allowed && !field.readOnly && acceptsText(field) && hasRoom(field)) {
      edit(field, `${currentText(field)}${character}`, character, "insertText");
      flushSync();
    }
    field.dispatchEvent(
      new KeyboardEvent("keyup", { key: character, bubbles: true, composed: true }),
    );
  }
  flushSync();
}

function clear(element: Element): void {
  const field = requireTextField(element, "clear");
  if (isDisabled(field) || field.readOnly) return;
  field.focus();
  const proceed = field.dispatchEvent(
    new InputEvent("beforeinput", {
      data: null,
      inputType: "deleteContentBackward",
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
  if (!proceed) return;
  field.value = "";
  typedText.delete(field);
  dispatchInput(field, null, "deleteContentBackward");
  flushSync();
}

/** A pointer event of the given type (a MouseEvent where the environment has no PointerEvent). */
function pointerEventOf(type: string, init: MouseEventInit & { pointerType?: string }): Event {
  return typeof PointerEvent === "function"
    ? new PointerEvent(type, init)
    : new MouseEvent(type, init);
}

function click(element: Element): void {
  if (isDisabled(element)) return;
  const init = { bubbles: true, cancelable: true, composed: true, pointerType: "mouse" };
  element.dispatchEvent(pointerEventOf("pointerdown", init));
  element.dispatchEvent(new MouseEvent("mousedown", init));
  if (element instanceof HTMLElement) element.focus();
  element.dispatchEvent(pointerEventOf("pointerup", init));
  element.dispatchEvent(new MouseEvent("mouseup", init));
  if (element instanceof HTMLElement) element.click();
  else element.dispatchEvent(new MouseEvent("click", init));
  flushSync();
}

/**
 * Whether a browser would render the element so that it can take focus: no `inert` or `display: none`
 * on it or an ancestor (the `hidden` attribute is `display: none` in the user agent style sheet), and not
 * `visibility: hidden`.
 */
function isFocusableHere(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    if (node.hasAttribute("inert")) return false;
    // happy-dom has no user agent style sheet, so `hidden` is read from the attribute unless the element's own
    // style says otherwise.
    const hiddenAttribute =
      node.hasAttribute("hidden") &&
      node.getAttribute("hidden") !== "until-found" &&
      !(node instanceof HTMLElement && node.style.display !== "");
    if (hiddenAttribute) return false;
    if (view !== null && view.getComputedStyle(node).display === "none") return false;
  }
  if (view === null) return true;
  const visibility = view.getComputedStyle(element).visibility;
  return visibility !== "hidden" && visibility !== "collapse";
}

function isTabbable(element: HTMLElement): boolean {
  return (
    !isDisabled(element) && element.getAttribute("tabindex") !== "-1" && isFocusableHere(element)
  );
}

/** The element Tab would focus next, or undefined when nothing can take focus. */
function nextTabStop(backwards: boolean): HTMLElement | undefined {
  const focusable = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    isTabbable,
  );
  if (focusable.length === 0) return undefined;
  const current = document.activeElement;
  const index = current instanceof HTMLElement ? focusable.indexOf(current) : -1;
  let nextIndex: number;
  if (index === -1) nextIndex = backwards ? focusable.length - 1 : 0;
  else nextIndex = (index + (backwards ? -1 : 1) + focusable.length) % focusable.length;
  return focusable[nextIndex];
}

/** Moves focus as a Tab press does once its keydown was not canceled. */
function moveFocus(backwards: boolean): void {
  const next = nextTabStop(backwards);
  if (next === undefined) return;
  next.focus();
  flushSync();
}

function tab(options: TabOptions = {}): void {
  const backwards = options.shift === true;
  if (nextTabStop(backwards) === undefined) return;
  const current = document.activeElement;
  if (current instanceof HTMLElement) {
    const allowed = current.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: backwards,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    if (!allowed) return;
  }
  moveFocus(backwards);
}

const NAMED_KEYS: Readonly<Record<string, string>> = {
  Enter: "Enter",
  Escape: "Escape",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Space: " ",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
};
const MODIFIERS = ["Shift", "Control", "Alt", "Meta"] as const;
type Modifier = (typeof MODIFIERS)[number];

/** Tokens of a keyboard string: `{Name}`, `{/Name}` and single characters. */
function keyTokens(text: string): Array<{ kind: "key" | "down" | "up"; name: string }> {
  const tokens: Array<{ kind: "key" | "down" | "up"; name: string }> = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if ((char === "{" || char === "[") && text[i + 1] === char) {
      tokens.push({ kind: "key", name: char });
      i += 1;
      continue;
    }
    if (char === "{") {
      const end = text.indexOf("}", i);
      if (end === -1)
        throw new SyntaxError(`userEvent.keyboard(): "{" is not closed in "${text}".`);
      const name = text.slice(i + 1, end);
      i = end;
      if (name.startsWith("/")) tokens.push({ kind: "up", name: name.slice(1) });
      else if ((MODIFIERS as readonly string[]).includes(name)) tokens.push({ kind: "down", name });
      else tokens.push({ kind: "key", name });
      continue;
    }
    tokens.push({ kind: "key", name: char });
  }
  return tokens;
}

/** Input types that take no typed text: a key press on them edits nothing. */
const NO_TEXT_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether typed characters go into the field (not a checkbox, a radio, a button, a color picker...). */
function acceptsText(field: TextField): boolean {
  return field instanceof HTMLTextAreaElement || !NO_TEXT_TYPES.has(field.type);
}

/**
 * What a key press does to the focused control besides typing: Enter clicks a button, a button-like input and a
 * summary; Space also toggles a checkbox and selects a radio. (A browser clicks on the key up for Space; the
 * click is the same.)
 */
function activateByKey(element: Element, key: string): void {
  if ((key !== "Enter" && key !== " ") || isDisabled(element)) return;
  if (element instanceof HTMLButtonElement) {
    element.click();
  } else if (element instanceof HTMLInputElement) {
    const buttonLike = ["button", "submit", "reset", "image"].includes(element.type);
    const toggle = key === " " && (element.type === "checkbox" || element.type === "radio");
    if (buttonLike || toggle) element.click();
  } else if (element.localName === "summary" && element instanceof HTMLElement) {
    element.click();
  }
}

/** Input types a browser counts as text fields for implicit form submission. */
const IMPLICIT_SUBMIT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "number",
]);

/**
 * What Enter does in a text field of a form (HTML "implicit submission"): it clicks the form's default
 * button (the first submit button), or, when there is none, submits a form that has one text field at most.
 * A disabled default button blocks the submission.
 */
function implicitSubmit(field: HTMLInputElement): void {
  const form = field.form;
  if (form === null || !IMPLICIT_SUBMIT_TYPES.has(field.type)) return;
  const defaultButton = Array.from(form.elements).find(
    (control): control is HTMLButtonElement | HTMLInputElement =>
      (control instanceof HTMLButtonElement && control.type === "submit") ||
      (control instanceof HTMLInputElement &&
        (control.type === "submit" || control.type === "image")),
  );
  if (defaultButton !== undefined) {
    if (!isDisabled(defaultButton)) defaultButton.click();
    return;
  }
  const blocking = Array.from(form.elements).filter(
    (control) => control instanceof HTMLInputElement && IMPLICIT_SUBMIT_TYPES.has(control.type),
  );
  if (blocking.length <= 1) form.requestSubmit();
}

function keyboard(text: string): void {
  const held = new Set<Modifier>();
  const target = (): Element => document.activeElement ?? document.body;
  const flags = (): KeyboardEventInit => ({
    shiftKey: held.has("Shift"),
    ctrlKey: held.has("Control"),
    altKey: held.has("Alt"),
    metaKey: held.has("Meta"),
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  for (const token of keyTokens(text)) {
    if (token.kind === "down" || token.kind === "up") {
      if (!(MODIFIERS as readonly string[]).includes(token.name)) {
        throw new SyntaxError(
          `userEvent.keyboard(): "{${token.kind === "up" ? "/" : ""}${token.name}}" is not a modifier.`,
        );
      }
      const modifier = token.name as Modifier;
      if (token.kind === "down") {
        held.add(modifier);
        target().dispatchEvent(new KeyboardEvent("keydown", { ...flags(), key: modifier }));
      } else {
        target().dispatchEvent(new KeyboardEvent("keyup", { ...flags(), key: modifier }));
        held.delete(modifier);
      }
      continue;
    }
    const key = NAMED_KEYS[token.name] ?? token.name;
    if (token.name.length > 1 && NAMED_KEYS[token.name] === undefined) {
      throw new SyntaxError(`userEvent.keyboard(): unknown key "{${token.name}}".`);
    }
    const element = target();
    const allowed = element.dispatchEvent(new KeyboardEvent("keydown", { ...flags(), key }));
    if (
      allowed &&
      isTextField(element) &&
      !isDisabled(element) &&
      !element.readOnly &&
      acceptsText(element)
    ) {
      if (key === "Backspace") {
        edit(element, currentText(element).slice(0, -1), null, "deleteContentBackward");
      } else if (key === "Enter") {
        // Only a textarea has a line to break; Enter in an input submits its form (below).
        if (element instanceof HTMLTextAreaElement && hasRoom(element)) {
          edit(element, `${currentText(element)}\n`, null, "insertLineBreak");
        }
      } else if (key.length === 1 && hasRoom(element)) {
        edit(element, `${currentText(element)}${key}`, key, "insertText");
      }
    }
    if (allowed) activateByKey(element, key);
    if (allowed && key === "Enter" && element instanceof HTMLInputElement) {
      if (!isDisabled(element)) implicitSubmit(element);
    }
    // This loop already dispatched the keydown; `tab()` would dispatch a second one.
    if (allowed && key === "Tab") moveFocus(held.has("Shift"));
    // The browser sends the keyup of a Tab press to the element Tab moved focus to.
    (key === "Tab" ? target() : element).dispatchEvent(
      new KeyboardEvent("keyup", { ...flags(), key }),
    );
    flushSync();
  }
  flushSync();
}

const POINTER_TOKEN = /^\[(\/)?(MouseLeft|MouseRight|MouseMiddle|Touch[A-Z])(>)?\]$/;

function pointer(input: PointerStep | readonly PointerStep[]): void {
  const steps = Array.isArray(input) ? (input as readonly PointerStep[]) : [input as PointerStep];
  let current: Element | undefined;
  const pressed = new Set<string>();
  for (const step of steps) {
    if (step.target !== undefined) current = step.target;
    if (step.keys === undefined) continue;
    if (current === undefined) throw new Error("userEvent.pointer(): no target element yet.");
    for (const token of step.keys.match(/\[[^\]]*\]/g) ?? []) {
      const parsed = POINTER_TOKEN.exec(token);
      if (parsed === null) throw new SyntaxError(`userEvent.pointer(): unknown key "${token}".`);
      const releasing = parsed[1] === "/";
      const name = parsed[2] as string;
      const holding = parsed[3] === ">";
      const touch = name.startsWith("Touch");
      const button = name === "MouseRight" ? 2 : name === "MouseMiddle" ? 1 : 0;
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        button,
        pointerType: touch ? "touch" : "mouse",
      };
      const pointerEvent = (type: string): Event =>
        typeof PointerEvent === "function"
          ? new PointerEvent(type, base)
          : new MouseEvent(type, base);
      const down = (): void => {
        if (current !== undefined && isDisabled(current)) return;
        current?.dispatchEvent(pointerEvent("pointerdown"));
        if (!touch) current?.dispatchEvent(new MouseEvent("mousedown", base));
        if (current instanceof HTMLElement) current.focus();
        pressed.add(name);
      };
      const up = (): void => {
        if (current !== undefined && isDisabled(current)) {
          pressed.delete(name);
          return;
        }
        current?.dispatchEvent(pointerEvent("pointerup"));
        if (!touch) current?.dispatchEvent(new MouseEvent("mouseup", base));
        if (pressed.delete(name)) {
          // Browsers dispatch click as a PointerEvent, which carries the pointer type.
          if (button === 2) current?.dispatchEvent(pointerEvent("contextmenu"));
          else current?.dispatchEvent(pointerEvent("click"));
        }
      };
      // Releasing a button that is not held does nothing, as in a real pointer.
      if (releasing) {
        if (pressed.has(name)) up();
      } else if (holding) down();
      else {
        down();
        up();
      }
      flushSync();
    }
  }
  flushSync();
}

function hover(element: Element): void {
  const init = { bubbles: true, cancelable: true, composed: true };
  element.dispatchEvent(new MouseEvent("pointerover", init));
  element.dispatchEvent(new MouseEvent("pointerenter", { ...init, bubbles: false }));
  element.dispatchEvent(new MouseEvent("mouseover", init));
  element.dispatchEvent(new MouseEvent("mouseenter", { ...init, bubbles: false }));
  element.dispatchEvent(new MouseEvent("pointermove", init));
  element.dispatchEvent(new MouseEvent("mousemove", init));
  flushSync();
}

function unhover(element: Element): void {
  const init = { bubbles: true, cancelable: true, composed: true };
  element.dispatchEvent(new MouseEvent("pointermove", init));
  element.dispatchEvent(new MouseEvent("mousemove", init));
  element.dispatchEvent(new MouseEvent("pointerout", init));
  element.dispatchEvent(new MouseEvent("pointerleave", { ...init, bubbles: false }));
  element.dispatchEvent(new MouseEvent("mouseout", init));
  element.dispatchEvent(new MouseEvent("mouseleave", { ...init, bubbles: false }));
  flushSync();
}

function dblClick(element: Element): void {
  click(element);
  click(element);
  element.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, cancelable: true, composed: true, detail: 2 }),
  );
  flushSync();
}

function selectOptions(element: Element, values: string | readonly string[]): void {
  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError("userEvent.selectOptions() needs a select element.");
  }
  const wanted = typeof values === "string" ? [values] : [...values];
  const options = Array.from(element.options);
  const chosen: HTMLOptionElement[] = [];
  for (const want of wanted) {
    const option = options.find((o) => o.value === want || o.textContent === want);
    if (option === undefined) throw new Error(`userEvent.selectOptions(): no option "${want}".`);
    // A browser cannot select a disabled option, or any option of a disabled select or optgroup.
    if (
      isDisabled(option) ||
      isDisabled(element) ||
      option.parentElement?.matches("optgroup[disabled]")
    )
      continue;
    chosen.push(option);
  }
  if (chosen.length === 0) return;
  for (const option of chosen) option.selected = true;
  element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  flushSync();
}

/**
 * Synchronous user interactions for tests: `type`, `clear`, `click`, `tab`, `keyboard`, `hover`,
 * `unhover`, `dblClick`, `selectOptions`, and `pointer`. They are not a full simulation of a browser
 * (no keyboard layout, IME, selection or pointer geometry), but each one dispatches real bubbling
 * events and leaves the DOM flushed. Prefer them to `fireEvent` when a test acts as a user would.
 *
 * @example
 * import { screen, userEvent } from "@shadow-js/testing/dom";
 *
 * userEvent.type(screen.getByLabelText("Name"), "Ada");
 * userEvent.click(screen.getByRole("button", { name: "Save" }));
 * @see UserEvent
 * @since 1.0.0
 */
export const userEvent: UserEvent = {
  type,
  clear,
  click,
  tab,
  keyboard,
  hover,
  unhover,
  pointer,
  dblClick,
  selectOptions,
  setup: () => userEvent,
};
