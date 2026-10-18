import { test } from "node:test";
import assert from "node:assert/strict";
import { createInputLog, keyNamesFrom, type InputLogOptions } from "../src/main/input-log.js";

const KEYS = { A: 30, K: 37, X: 45, Enter: 28, Tab: 15, Space: 57, Ctrl: 29, Shift: 42, Meta: 3675, ArrowDown: 57424, Comma: 51 };

function setup(over: Partial<InputLogOptions> = {}) {
  const out: Record<string, unknown>[] = [];
  let t = 0;
  const log = createInputLog({
    toDip: (p) => p,
    area: { x: 1920, y: 0, width: 1440, height: 900 }, // a second display, right of the main one
    keyNames: keyNamesFrom(KEYS),
    ownShortcuts: new Set(["Alt+Shift+x"]),
    emit: (e) => out.push(e as Record<string, unknown>),
    now: () => (t += 50),
    ...over,
  });
  return { log, out };
}

const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

test("clicks are relative to the recorded display", () => {
  const { log, out } = setup();
  log.mouseDown({ x: 2020, y: 100, button: 1 });
  log.mouseUp({ x: 2022, y: 101, button: 1, clicks: 1 });
  assert.deepEqual(out, [{ type: "click", x: 100, y: 100, button: 0 }]);
});

test("a drag is not a click; right click is contextmenu; double click adds dblclick", () => {
  const { log, out } = setup();
  log.mouseDown({ x: 2020, y: 100, button: 1 });
  log.mouseUp({ x: 2200, y: 300, button: 1 });
  log.mouseDown({ x: 2000, y: 50, button: 2 });
  log.mouseUp({ x: 2000, y: 50, button: 2 });
  log.mouseDown({ x: 2000, y: 50, button: 1 });
  log.mouseUp({ x: 2000, y: 50, button: 1, clicks: 2 });
  assert.deepEqual(
    out.map((e) => e["type"]),
    ["contextmenu", "click", "dblclick"],
  );
});

test("leaving the display emits one leave; the recorder's own windows are ignored", () => {
  const { log, out } = setup({ isOwn: (p) => p.x > 3000 });
  log.mouseMove({ x: 100, y: 100 });
  log.mouseMove({ x: 120, y: 100 });
  log.mouseMove({ x: 2000, y: 10 });
  log.mouseDown({ x: 3100, y: 10, button: 1 });
  log.mouseUp({ x: 3100, y: 10, button: 1 });
  assert.deepEqual(out, [{ type: "leave" }, { type: "move", x: 80, y: 10 }]);
});

test("typed characters are never recorded; shortcuts and named keys are", () => {
  const { log, out } = setup();
  log.keyDown({ keycode: KEYS.A, ...mods });
  log.keyDown({ keycode: KEYS.A, ...mods, shiftKey: true });
  log.keyDown({ keycode: KEYS.Space, ...mods });
  log.keyDown({ keycode: KEYS.K, ...mods, metaKey: true });
  log.keyDown({ keycode: KEYS.Comma, ...mods, ctrlKey: true });
  log.keyDown({ keycode: KEYS.Enter, ...mods });
  log.keyDown({ keycode: KEYS.Tab, ...mods, shiftKey: true });
  log.keyDown({ keycode: KEYS.Ctrl, ...mods, ctrlKey: true }); // a lone modifier
  log.keyDown({ keycode: KEYS.X, ...mods, altKey: true, shiftKey: true }); // the recorder's finish shortcut
  assert.deepEqual(
    out.map((e) => e["key"]),
    ["text", "text", "text", "Meta+k", "Ctrl+,", "Enter", "Shift+Tab"],
  );
});

test("wheel accumulates into a virtual scroll offset", () => {
  const { log, out } = setup();
  log.wheel({ x: 2000, y: 100, rotation: 3, amount: 3, direction: 3 });
  log.wheel({ x: 2000, y: 100, rotation: 3, amount: 3, direction: 3 });
  assert.equal(out.length, 1); // the second one is within 100 ms
  assert.deepEqual(out[0], { type: "scroll", scrollX: 0, scrollY: 120 });
});
