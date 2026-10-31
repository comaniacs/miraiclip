// Tests for the app-film kit's own logic.   node --test examples/gallery/_lib/app-film/test/
// The browser modules run in a VM with the globals the build would inject; whole films are covered by the
// integration path (launch-kiteline renders pixel-identical to its pre-kit version; the template builds, checks and
// renders clean).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { retypeAt, keyTimes, validateActions } from "../timeline.mjs";
import { createScore } from "../audio.mjs";

const KIT = path.dirname(fileURLToPath(new URL("../build.mjs", import.meta.url)));

function browserKit() {
  const ctx = vm.createContext({ W: 1920, H: 1080, PERSP: 1600, WIN_W: 1440, WIN_H: 900, Math, document: {} });
  for (const f of ["film-core.js", "replay.js", "overlay.js"]) vm.runInContext(fs.readFileSync(path.join(KIT, "browser", f), "utf8"), ctx);
  return ctx;
}

test("retype backspaces the old text, then types the new", () => {
  const a = { from: "Hello there", to: "Hi" };
  assert.equal(retypeAt(a, 0), "Hello there");
  assert.equal(retypeAt(a, 0.35), "");
  assert.equal(retypeAt(a, 1), "Hi");
  assert.equal(retypeAt(a, 2), "Hi", "clamped past the end");
});

test("the browser's retypeAt is the same function as the score's", () => {
  const k = browserKit(), a = { from: "Meet Fieldnote.", to: "Your meetings deserve better notes." };
  for (const u of [0, 0.1, 0.34, 0.5, 0.77, 1]) assert.equal(k.retypeAt(a, u), retypeAt(a, u));
});

test("key times: one per typed character, fewer for a held backspace, all inside the action", () => {
  const acts = [{ t: 1, kind: "type", text: "abcd", dur: 1 }, { t: 3, kind: "retype", from: "12345678", to: "xy", dur: 1 }, { t: 5, kind: "click", sel: "b" }];
  const k = keyTimes(acts);
  assert.equal(k.length, 4 + 2 + 2);
  assert.deepEqual(k.slice(0, 4), [1.25, 1.5, 1.75, 2]);
  assert.ok(k.every((t) => (t > 1 && t <= 2) || (t > 3 && t <= 4)));
});

test("validateActions catches the mistakes that break a replay", () => {
  const ok = [{ t: 1, kind: "click", sel: "a" }, { t: 2, kind: "type", sel: "i", text: "x", dur: 0.5 }];
  assert.equal(validateActions(ok, 10), ok);
  assert.throws(() => validateActions([{ t: 1, kind: "tap", sel: "a" }], 10), /unknown kind/);
  assert.throws(() => validateActions([{ t: 2, kind: "click", sel: "a" }, { t: 1, kind: "click", sel: "b" }], 10), /not after/);
  assert.throws(() => validateActions([{ t: 1, kind: "type", sel: "i", text: "abc", dur: 2 }, { t: 2, kind: "click", sel: "b" }], 10), /still typing/);
  assert.throws(() => validateActions([{ t: 1, kind: "click" }], 10), /no selector/);
  assert.throws(() => validateActions([{ t: 11, kind: "click", sel: "a" }], 10), /outside/);
});

test("camera curves pass through every key and never overshoot", () => {
  const k = browserKit(), keys = [[0, 0], [1, 10], [2, 10], [3, -5], [4, 0]], f = k.curve(keys);
  keys.forEach(([t, v]) => assert.ok(Math.abs(f(t) - v) < 1e-9));
  for (let t = 1; t <= 2; t += 0.05) assert.ok(Math.abs(f(t) - 10) < 1e-9, "flat between equal keys");
  for (let t = 2; t <= 3; t += 0.05) assert.ok(f(t) <= 10 + 1e-9 && f(t) >= -5 - 1e-9, "inside the keys' range");
});

test("frontal at dist = PERSP is 1:1, and the target projects to the screen centre plus the offset", () => {
  const k = browserKit(), cam = k.filmCamera([[0, 0, 0, 1600, 0, 0, 0, 0], [1, 30, 20, 2400, 100, -50, 200, 40]], [[0, 0, 0]]);
  const c0 = cam.camAt(0), p = k.project([720, 450, 0], c0);
  assert.ok(Math.abs(p.x - (960 + 720)) < 1e-6 && Math.abs(p.y - (540 + 450)) < 1e-6 && Math.abs(p.k - 1) < 1e-9);
  const c1 = cam.camAt(1), q = k.project(c1.tgt, c1);
  assert.ok(Math.abs(q.x - (960 + 200)) < 1e-6 && Math.abs(q.y - (540 + 40)) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...k.V.sub(k.camPos(c1), c1.tgt)) - c1.dist) < 1e-6, "the camera sits dist from its target");
  assert.equal(cam.motionOf(0.5, 0.5), 0);
});

test("the score is exactly the requested length and refuses to write silence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-")), s = createScore(1.5);
  assert.throws(() => s.write(path.join(dir, "silent.wav")), /silent/);
  s.uiFromActions([{ t: 0.5, kind: "click", sel: "a" }], [0.7, 0.8]);
  s.bell(0.2, 74, 0.05);
  const w = s.write(path.join(dir, "a.wav"));
  assert.equal(w.seconds, 1.5);
  assert.equal(fs.statSync(w.file).size, 44 + 1.5 * 48000 * 4);
  fs.rmSync(dir, { recursive: true });
});

test("new.mjs scaffolds a film with every placeholder filled, and refuses to overwrite", () => {
  const name = "kit-test-" + process.pid, dest = path.join(KIT, "..", "..", name);
  try {
    const r = spawnSync("node", [path.join(KIT, "new.mjs"), name, "--title", "Acme <Notes>"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const all = [];
    const walk = (d) => fs.readdirSync(d).forEach((f) => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : all.push(p); });
    walk(dest);
    for (const f of all) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /__[A-Z0-9]+__/, `placeholder left in ${path.relative(dest, f)}`);
    assert.match(fs.readFileSync(path.join(dest, "build.mjs"), "utf8"), /Acme &lt;Notes&gt;/, "the title is HTML-escaped");
    const again = spawnSync("node", [path.join(KIT, "new.mjs"), name], { encoding: "utf8" });
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /refusing to overwrite/);
    const b = spawnSync("node", ["build.mjs"], { cwd: dest, encoding: "utf8" });
    assert.equal(b.status, 0, b.stderr);
    const html = fs.readFileSync(path.join(dest, "sequence.html"), "utf8");
    assert.match(html, /#world>div:not\(#win\)/, "the window-offset fix is in the base CSS");
    assert.match(html, /function appReplay/, "the kit's browser modules are embedded");
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
