// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createEventLogger, describeTarget, isSensitiveElement, labelFor, selectorFor } from "../src/index.js";

function page(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

function clock() {
  let t = 0;
  return { now: () => t, advance: (us: number) => (t += us) };
}

describe("isSensitiveElement", () => {
  it("flags password, card, one-time-code and secret-named fields, and [data-private] subtrees", () => {
    const doc = page(`
      <input id="pw" type="password">
      <input id="cc" autocomplete="cc-number">
      <input id="otp" autocomplete="one-time-code">
      <input id="key" name="api_key">
      <div data-private><span id="inner">secret</span></div>
      <input id="email" type="email" name="email">
      <button id="save">Save</button>`);
    for (const id of ["pw", "cc", "otp", "key", "inner"]) expect(isSensitiveElement(doc.getElementById(id)!), id).toBe(true);
    for (const id of ["email", "save"]) expect(isSensitiveElement(doc.getElementById(id)!), id).toBe(false);
  });
});

describe("labelFor / selectorFor", () => {
  it("labels from aria-label, <label for>, wrapping label, button text and alt — never a field's value", () => {
    const doc = page(`
      <button id="a" aria-label="Close dialog">×</button>
      <label for="name">Full name</label><input id="name" value="Jane Doe">
      <label>Email <input id="email" value="jane@example.com"></label>
      <button id="b">  Save   changes </button>
      <img id="logo" alt="Acme logo">
      <input id="bare" value="typed secret">`);
    expect(labelFor(doc.getElementById("a")!)).toBe("Close dialog");
    expect(labelFor(doc.getElementById("name")!)).toBe("Full name");
    expect(labelFor(doc.getElementById("email")!)).toContain("Email");
    expect(labelFor(doc.getElementById("email")!)).not.toContain("jane@");
    expect(labelFor(doc.getElementById("b")!)).toBe("Save changes");
    expect(labelFor(doc.getElementById("logo")!)).toBe("Acme logo");
    expect(labelFor(doc.getElementById("bare")!)).toBeUndefined();
  });

  it("prefers id, then data-testid, then a short nth-of-type path that finds the element", () => {
    const doc = page(`<main><ul><li>a</li><li><button data-testid="x">x</button></li><li><span>c</span></li></ul></main>`);
    expect(selectorFor(doc.querySelector("button")!)).toBe('[data-testid="x"]');
    const span = doc.querySelector("span")!;
    const sel = selectorFor(span);
    expect(doc.querySelector(sel)).toBe(span);
    page(`<div id="root"><p>x</p></div>`);
    expect(selectorFor(document.getElementById("root")!)).toBe("#root");
  });

  it("describeTarget carries tag, role, label, rect and the sensitive flag", () => {
    const doc = page(`<div role="button" id="go" aria-label="Go">Go</div><input id="pw" type="password">`);
    expect(describeTarget(doc.getElementById("go")!)).toMatchObject({ selector: "#go", tag: "div", role: "button", label: "Go", rect: { x: 0, y: 0 } });
    expect(describeTarget(doc.getElementById("pw")!).sensitive).toBe(true);
  });
});

describe("createEventLogger", () => {
  it("logs clicks on the interactive ancestor, throttles moves, and stops listening on stop()", () => {
    const doc = page(`<button id="save"><span id="icon">💾</span> Save</button>`);
    const c = clock();
    const log = createEventLogger({ document: doc, now: c.now, moveIntervalMs: 33 });
    log.start();
    for (let i = 0; i < 10; i++) {
      c.advance(10_000); // 10 ms apart → about one in three kept
      doc.dispatchEvent(new MouseEvent("pointermove", { clientX: i, clientY: i, bubbles: true }));
    }
    c.advance(5_000);
    doc.getElementById("icon")!.dispatchEvent(new MouseEvent("click", { clientX: 12, clientY: 8, bubbles: true }));
    const events = log.stop();
    doc.getElementById("icon")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(log.events()).toHaveLength(events.length); // nothing after stop

    expect(events[0]).toMatchObject({ type: "navigate" });
    const moves = events.filter((e) => e.type === "move");
    expect(moves.length).toBeGreaterThanOrEqual(3);
    expect(moves.length).toBeLessThanOrEqual(4);
    const click = events.find((e) => e.type === "click");
    expect(click).toMatchObject({ tUs: 105_000, x: 12, y: 8, button: 0, target: { selector: "#save", tag: "button", label: "💾 Save" } });
  });

  it("never records typed characters; keeps named keys and shortcuts", () => {
    const doc = page(`<input id="q" type="text">`);
    const log = createEventLogger({ document: doc, now: () => 0 });
    log.start();
    const q = doc.getElementById("q")!;
    for (const init of [{ key: "h" }, { key: "i" }, { key: "Enter" }, { key: "k", metaKey: true }, { key: "Tab", shiftKey: true }]) {
      q.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true }));
    }
    const keys = log.stop().filter((e) => e.type === "key").map((e) => (e as { key: string }).key);
    expect(keys).toEqual(["text", "text", "Enter", "Meta+k", "Shift+Tab"]);
  });

  it("collapses a burst of input on one field into one event and flags sensitive fields", () => {
    const doc = page(`<input id="pw" type="password">`);
    const c = clock();
    const log = createEventLogger({ document: doc, now: c.now });
    log.start();
    const pw = doc.getElementById("pw")!;
    for (let i = 0; i < 5; i++) {
      c.advance(100_000);
      pw.dispatchEvent(new Event("input", { bubbles: true }));
    }
    c.advance(2_000_000);
    pw.dispatchEvent(new Event("input", { bubbles: true }));
    const inputs = log.stop().filter((e) => e.type === "input");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({ target: { sensitive: true } });
    expect(JSON.stringify(inputs)).not.toContain("value");
  });

  it("ignores interactions while paused; markers carry their data", () => {
    const doc = page(`<button id="b">B</button>`);
    const log = createEventLogger({ document: doc, now: () => 1 });
    log.start();
    log.pause();
    doc.getElementById("b")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    log.resume();
    log.mark("Step 1", { kind: "step" });
    const events = log.stop();
    expect(events.some((e) => e.type === "click")).toBe(false);
    expect(events.at(-1)).toEqual({ tUs: 1, type: "marker", label: "Step 1", data: { kind: "step" } });
  });
});

describe("ignore", () => {
  it("leaves interactions on ignored elements (a recorder's own bar) out of the log", () => {
    const doc = page(`<button id="save">Save</button><div id="bar"><button id="stop">Stop</button></div>`);
    const c = clock();
    const log = createEventLogger({ document: doc, now: c.now, ignore: (el) => el.closest("#bar") !== null });
    log.start();
    doc.getElementById("save")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    c.advance(1000);
    doc.getElementById("stop")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clicks = log.stop().filter((e) => e.type === "click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.type === "click" && clicks[0]!.target?.label).toBe("Save");
  });
});

describe("streaming and leave", () => {
  it("passes each event to onEvent, and logs the pointer leaving the page once", () => {
    const doc = page(`<button id="save">Save</button>`);
    const seen: string[] = [];
    const log = createEventLogger({ document: doc, now: () => 0, onEvent: (e) => seen.push(e.type) });
    log.start();
    doc.getElementById("save")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    doc.documentElement.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: null }));
    doc.documentElement.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: null }));
    expect(log.stop().map((e) => e.type)).toEqual(["navigate", "click", "leave"]);
    expect(seen).toEqual(["navigate", "click", "leave"]);
  });
});
