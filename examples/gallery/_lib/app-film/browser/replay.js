// ---- app-film kit · replay: the real app, replayed. Every frame mounts a fresh app and performs every scripted
// action whose time has come: real clicks on real elements and real input events into real fields. So the window
// shows what the app actually renders after those actions, and any frame renders the same alone, out of order, or
// as a motion-blur sample.
//
//   var R = appReplay({ slot, bar, mount: function (host) { ... }, actions: ACTIONS });
//   var rec = R.replay(t);   // rec.at[i]: the target rect of action i when it ran; rec.caps[key]: snapshots
//   R.rect(el), R.q(sel), R.host()
//
// Action kinds: click | type { text, dur } | retype { from, to, dur } | focus. cap: { key: selector } snapshots
// elements (outerHTML + rect) just before the action. The exporter captures the DOM, not live form state, so typed
// values are mirrored into the markup; the focused field gets .is-focused (a background tab never shows :focus).
function retypeAt(a, u) { // backspace the old text (35 % of the time), then type the new
  u = c01(u);
  if (u < 0.35) return a.from.slice(0, Math.round(a.from.length * (1 - u / 0.35)));
  return a.to.slice(0, Math.round(a.to.length * (u - 0.35) / 0.65));
}
function appReplay(opts) {
  var slot = opts.slot, bar = opts.bar || 0, host = null;
  function rect(el) { // layout rect in window coordinates: 3D transforms on the window don't distort it
    var x = 0, y = 0, e = el;
    while (e && e !== host) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x: x, y: y + bar, w: el.offsetWidth, h: el.offsetHeight };
  }
  function q(sel) { return host.querySelector(sel); }
  function mirror(el) { if (el.tagName === "TEXTAREA") el.textContent = el.value; else el.setAttribute("value", el.value); }
  function replay(t) {
    host = document.createElement("div"); // a new host each frame, so listeners from the last mount can't stack up
    host.className = "appwrap";
    slot.replaceChildren(host);
    opts.mount(host);
    var rec = { at: {}, caps: {}, focus: null };
    opts.actions.forEach(function (a, i) {
      if (t < a.t) return;
      var el = q(a.sel);
      if (!el) throw new Error("film action " + i + " at " + a.t + " s: nothing matches " + a.sel);
      rec.at[i] = rect(el);
      if (a.cap) Object.keys(a.cap).forEach(function (k) { var c = q(a.cap[k]); rec.caps[k] = c ? { html: c.outerHTML, rect: rect(c) } : null; });
      var u = a.dur ? c01((t - a.t) / a.dur) : 1;
      if (a.kind === "click") { el.click(); rec.focus = null; }
      else if (a.kind === "focus") rec.focus = a.sel;
      else if (a.kind === "type" || a.kind === "retype") {
        // retype swaps the field's leading text (a.from), which it must start with, and keeps the rest
        el.value = a.kind === "type" ? a.text.slice(0, Math.round(a.text.length * u)) : retypeAt(a, u) + el.value.slice(a.from.length);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        mirror(el);
        rec.focus = a.sel;
      } else throw new Error("film action " + i + ": unknown kind " + a.kind);
    });
    if (rec.focus && q(rec.focus)) q(rec.focus).classList.add("is-focused");
    return rec;
  }
  return { replay: replay, rect: rect, q: q, host: function () { return host; } };
}
