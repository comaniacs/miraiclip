// Unit tests for the __TITLE__ core.   node --test app/test/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../js/core.js");
const run = (s, ...actions) => actions.reduce((x, a) => C.reduce(x, a), s);

test("adding a task appends it, clears the draft and confirms", () => {
  const s = run(C.initialState(), { type: "DRAFT", value: "  Ship it  " }, { type: "ADD" });
  assert.equal(s.items.at(-1).text, "Ship it");
  assert.equal(s.draft, "");
  assert.equal(s.toast.text, "Added.");
});
test("an empty draft is refused with an error", () => {
  const s = run(C.initialState(), { type: "ADD" });
  assert.equal(s.items.length, 3);
  assert.equal(s.toast.kind, "error");
});
test("toggling flips one task and the remaining count follows", () => {
  const s = run(C.initialState(), { type: "TOGGLE", id: "i2" });
  assert.equal(s.items[1].done, true);
  assert.equal(C.remaining(s), 1);
});
test("the reducer never mutates its input", () => {
  const s = C.initialState(), snap = JSON.stringify(s);
  run(s, { type: "DRAFT", value: "x" }, { type: "ADD" }, { type: "TOGGLE", id: "i1" });
  assert.equal(JSON.stringify(s), snap);
});
