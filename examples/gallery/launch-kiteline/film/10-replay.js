// ---- the real app, replayed. Every frame mounts a fresh Kiteline (the same core/views/ui code as app/) and
// performs every scripted action whose time has come: real clicks on real buttons, real input events into real
// fields. So whatever the viewer sees in the window at time t is what the app actually renders after those
// actions. That also makes any frame render the same alone, out of order, or as a motion-blur sample.
var WIN_W = 1440, WIN_H = 900, BAR = 40, APP_H = WIN_H - BAR;
var winEl = $("win"), hostSlot = $("appslot");
var app = null, host = null;

// a rect in window coordinates (layout, so 3D transforms on the window don't distort it)
function layoutRect(el) {
  var x = 0, y = 0, e = el;
  while (e && e !== host) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
  return { x: x, y: y + BAR, w: el.offsetWidth, h: el.offsetHeight };
}
function q(sel) { return host.querySelector(sel); }
function snapshot(el) {
  if (!el) return null;
  return { html: el.outerHTML, rect: layoutRect(el) };
}

function replay(t) {
  // a new host each frame: listeners from the last mount must not stack up
  host = document.createElement("div");
  host.className = "appwrap";
  hostSlot.replaceChildren(host);
  app = KitelineUI.mount(host, { today: T.TODAY, storage: null });
  var rec = { at: {}, caps: {}, focus: null };
  ACTIONS.forEach(function (a, i) {
    if (t < a.t) return;
    var el = q(a.sel);
    if (!el) throw new Error("film action " + i + " at " + a.t + " s: nothing matches " + a.sel);
    rec.at[i] = layoutRect(el);
    if (a.cap) Object.keys(a.cap).forEach(function (k) { rec.caps[k] = snapshot(q(a.cap[k])); });
    var u = a.dur ? c01((t - a.t) / a.dur) : 1;
    if (a.kind === "click") { el.click(); rec.focus = null; }
    else if (a.kind === "focus") rec.focus = a.sel;
    else if (a.kind === "type" || a.kind === "retype") {
      // retype swaps the caption's first line, which the generated draft always starts with, and keeps the rest
      el.value = a.kind === "type" ? a.text.slice(0, Math.round(a.text.length * u)) : retypeAt(a, u) + el.value.slice(a.from.length);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      // the exporter captures the DOM, not live form state: mirror the value into the markup so the field shows it
      if (el.tagName === "TEXTAREA") el.textContent = el.value; else el.setAttribute("value", el.value);
      rec.focus = a.sel;
    }
  });
  // the field being typed in looks focused (a background tab never shows :focus)
  if (rec.focus && q(rec.focus)) q(rec.focus).classList.add("kl-focus");
  return rec;
}
