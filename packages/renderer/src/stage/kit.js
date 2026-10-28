/*
 * Miraiclip stage kit: the runtime for scripted html sequences.
 *
 * Loaded into a scripted clip's frame (data-libs="stage", which brings
 * anime.js v4 with it). A sequence is written as:
 *
 *   <div class="stage" data-duration="12"> … <div class="world"> … </div> </div>
 *   <script>
 *     stage.build((tl, S) => {
 *       tl.label("hook", 0)
 *         .from(".word", { y: S.h(6), opacity: 0, blur: 12, duration: 0.6, stagger: 0.08, ease: "expo.out" }, "hook")
 *         .camera({ zoom: 1.15, tiltX: -6, duration: 2.5 }, "<");
 *     });
 *   </script>
 *
 * Times are seconds. Positions: a number, a label, "label+=0.3", "<" (start
 * of the previous step), ">" (its end), "<+=0.2", ">-=0.1", "+=0.5" / "-=0.5"
 * (relative to the end of the timeline). Sizes come from S.w/h/min (percent of
 * the stage), so a sequence re-lays itself out at any frame size.
 *
 * Determinism: the kit owns the timeline and the seek hook. Every frame seeks
 * to 0 and then to t (after a one-time warm-up), so a frame never depends on
 * the frame before it. The timeline is built only after fonts load, so text
 * measured while building matches the final render.
 *
 * The stage root reports back on itself (visible in the snapshot markup):
 * data-stage-duration, data-stage-labels (JSON), data-stage-error.
 */
(function () {
  "use strict";
  var A = window.anime;
  var readyResolve;
  window.__miraiclipReady = new Promise(function (r) { readyResolve = r; });

  function root() {
    return document.querySelector(".stage") || document.body.firstElementChild || document.body;
  }
  function size() {
    var el = root();
    var w = el.clientWidth || window.innerWidth;
    var h = el.clientHeight || window.innerHeight;
    return { w: w, h: h };
  }

  // ---- easing: common names → anime.js v4 ease strings
  var POW = { power1: 2, power2: 3, power3: 4, power4: 5, quad: 2, cubic: 3, quart: 4, quint: 5 };
  var NAMED = { sine: "Sine", expo: "Expo", circ: "Circ", back: "Back", elastic: "Elastic", bounce: "Bounce" };
  function ease(name) {
    if (typeof name === "function") return name;
    if (!name) return "out(3)";
    var n = String(name).trim();
    if (n === "none" || n === "linear") return "linear";
    var st = /^steps\((\d+)\)$/.exec(n);
    if (st) return A.steps(parseInt(st[1], 10));
    var sp = /^spring(?:\(\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\))?$/.exec(n);
    if (sp) return springEase(sp[1] === undefined ? 0.55 : parseFloat(sp[1]), sp[2] === undefined ? 14 : parseFloat(sp[2]));
    if (/^(in|out|inOut)(\(.*\))?$/.test(n) || /^(in|out|inOut)[A-Z]/.test(n)) return n; // already anime syntax
    var m = /^([a-z0-9]+)\.(in|out|inOut)(\(.*\))?$/i.exec(n);
    if (m) {
      var fam = m[1].toLowerCase(), dir = m[2], arg = m[3] || "";
      if (POW[fam]) return dir + "(" + POW[fam] + ")";
      if (NAMED[fam]) return dir + NAMED[fam] + arg;
    }
    if (POW[n]) return "out(" + POW[n] + ")";
    if (NAMED[n]) return "out" + NAMED[n];
    return n;
  }


  // ---- spring ease: a closed-form damped spring over the tween's duration.
  // omega is raised when needed so the motion has settled (within 0.1 %) by the end.
  function springEase(zeta, omega) {
    zeta = Math.min(0.999, Math.max(0.05, zeta));
    omega = Math.max(omega, 6.91 / zeta);
    var wd = omega * Math.sqrt(1 - zeta * zeta);
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    };
  }
  /** An ease name (any the kit accepts) as a plain function of progress 0..1, for the version 2 verbs. */
  function easeFn(name) {
    var e = ease(name);
    if (typeof e === "function") return e;
    if (e === "linear") return function (x) { return x; };
    var m = /^(\w+?)(?:\((.*)\))?$/.exec(e);
    var f = m && A.eases[m[1]];
    if (!f) return function (x) { return x; };
    if (m[2] !== undefined) return f.apply(null, m[2].split(",").map(parseFloat));
    var g = f();
    return typeof g === "function" ? g : f;
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }

  // ---- version 2: the operated camera, carry verbs and events.
  // Everything here is a pure function of the time t, written to the DOM after the
  // timeline seeks, so a frame never depends on the one before it.
  var v2 = null;
  function newV2() {
    return { moves: [], drivers: [], hits: [], carries: [], rests: [], cuts: [], follows: [], handhelds: [], shakes: [], grids: [], pointers: [], depth: [], lod: [], camFrom: [], focus: [], focusEls: null };
  }
  function need2(verb) {
    if (!v2) throw new Error(verb + '(): needs data-stage-version="2" on the stage root. Add the attribute, or remove this call.');
  }
  function describe(el) {
    if (!el || !el.tagName) return String(el);
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList && el.classList.length ? "." + Array.prototype.join.call(el.classList, ".") : "");
  }
  /** Exactly one element, with an error that names the selector and the fix. */
  function one(target, verb, role) {
    if (target && target.nodeType === 1) return target;
    var list = typeof target === "string" ? document.querySelectorAll(target) : [];
    if (list.length === 0) throw new Error(verb + '(): no element matches "' + target + '"' + (role ? " (" + role + ")" : "") + ". Check the selector, and that the element is in the markup before stage.build.");
    if (list.length > 1) throw new Error(verb + '(): "' + target + '" matches ' + list.length + " elements" + (role ? " (" + role + ")" : "") + ", expected one. Use a more specific selector.");
    return list[0];
  }
  function many(target, verb, role) {
    if (target && target.nodeType === 1) return [target];
    var list = typeof target === "string" ? Array.prototype.slice.call(document.querySelectorAll(target)) : Array.prototype.slice.call(target || []);
    if (list.length === 0) throw new Error(verb + '(): no element matches "' + target + '"' + (role ? " (" + role + ")" : "") + ". Check the selector, and that the elements are in the markup before stage.build.");
    return list;
  }
  /** An element's resting layout box in stage units (its own transforms are ignored; the camera is at rest at build time). */
  function layoutRect(el) {
    var r0 = root().getBoundingClientRect();
    var tr = el.style.transform, tl2 = el.style.translate, sc = el.style.scale, ro = el.style.rotate;
    el.style.transform = "none"; el.style.translate = "none"; el.style.scale = "none"; el.style.rotate = "none";
    var r = el.getBoundingClientRect();
    el.style.transform = tr; el.style.translate = tl2; el.style.scale = sc; el.style.rotate = ro;
    return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height };
  }
  function centerOf(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  /** Where an element is right now (all transforms included) in stage units, with the camera set aside. */
  function liveCenter(el) {
    var w = document.querySelector(".world");
    var saved = w ? w.style.transform : "";
    if (w) w.style.transform = "none";
    var r0 = root().getBoundingClientRect();
    var r = el.getBoundingClientRect();
    if (w) w.style.transform = saved;
    return { x: r.left - r0.left + r.width / 2, y: r.top - r0.top + r.height / 2 };
  }
  function parseColor(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    var p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function mixColor(a, b, u) {
    if (!a || !b) return null;
    return "rgba(" + [lerp(a.r, b.r, u), lerp(a.g, b.g, u), lerp(a.b, b.b, u)].map(Math.round).join(",") + "," + lerp(a.a, b.a, u).toFixed(3) + ")";
  }
  function labelOf(target, el) { return typeof target === "string" ? target : describe(el); }
  function round3(x) { return Math.round(x * 1000) / 1000; }

  // Several verbs can touch one element (a morph target is the next morph's source), so
  // opacity is the product of every contribution and transforms are joined in call order.
  var opMap = null, tfMap = null;
  function op(el, v) { opMap.set(el, (opMap.has(el) ? opMap.get(el) : 1) * v); }
  function tf(el, str) { if (!tfMap.has(el)) tfMap.set(el, []); tfMap.get(el).push(str); }
  function applyDrivers(t) {
    opMap = new Map(); tfMap = new Map();
    for (var i = 0; i < v2.drivers.length; i++) v2.drivers[i].apply(t);
    opMap.forEach(function (v, el) { el.style.opacity = String(round3(v)); });
    tfMap.forEach(function (parts, el) { el.style.transform = parts.join(" "); });
  }

  // ---- the camera track: keyed moves (zoom in log space), each from the state where it starts
  var CAM_INIT = { x: 0, y: 0, zl: 0, r: 0, tx: 0, ty: 0 };
  function camCopy(s) { return { x: s.x, y: s.y, zl: s.zl, r: s.r, tx: s.tx, ty: s.ty }; }
  function applyMove(m, from, t) {
    var u = m.easeFn(clamp01((t - m.start) / m.dur));
    var out = camCopy(from);
    if (m.to.zl !== undefined) out.zl = lerp(from.zl, m.to.zl, u);
    if (m.to.r !== undefined) out.r = lerp(from.r, m.to.r, u);
    if (m.to.tx !== undefined) out.tx = lerp(from.tx, m.to.tx, u);
    if (m.to.ty !== undefined) out.ty = lerp(from.ty, m.to.ty, u);
    if (m.to.x !== undefined) out.x = lerp(from.x, m.to.x, u);
    if (m.to.y !== undefined) out.y = lerp(from.y, m.to.y, u);
    if (m.pin) {
      // keep the anchor's world point on its screen position as the zoom changes
      var z0 = Math.exp(from.zl), z = Math.exp(out.zl);
      var q0x = from.x + z0 * m.pin.px, q0y = from.y + z0 * m.pin.py;
      var qx = lerp(q0x, m.pin.qx, u), qy = lerp(q0y, m.pin.qy, u);
      out.x = qx - z * m.pin.px;
      out.y = qy - z * m.pin.py;
    }
    return out;
  }
  /** The keyed camera at time t: each move runs from the state its predecessors left at its start. */
  function camBase(t, upTo) {
    var cur = camCopy(CAM_INIT);
    var n = upTo === undefined ? v2.moves.length : upTo;
    for (var i = 0; i < n; i++) {
      var m = v2.moves[i];
      if (t < m.start) break;
      cur = applyMove(m, m.from || cur, t);
    }
    return cur;
  }
  function finalizeCamera() {
    v2.moves.sort(function (a, b) { return a.start - b.start; });
    for (var i = 0; i < v2.moves.length; i++) {
      var m = v2.moves[i];
      m.from = camBase(m.start, i);
      if (m.resetOf) m.to = camCopy(m.resetOf.from);
    }
  }
  /** Follow target samples: p(t) at 60 Hz over [from - lead, to + lead], target centre relative to the stage centre. */
  function sampleAt(f, t) {
    var u = (t - f.t0) * 60;
    var i = Math.floor(u);
    if (i < 0) return f.pts[0];
    if (i >= f.pts.length - 1) return f.pts[f.pts.length - 1];
    var k = u - i;
    return { x: lerp(f.pts[i].x, f.pts[i + 1].x, k), y: lerp(f.pts[i].y, f.pts[i + 1].y, k) };
  }
  function restFactor(t) {
    var f = 1;
    for (var i = 0; i < v2.rests.length; i++) {
      var r = v2.rests[i];
      var d = t >= r.from && t <= r.to ? 0 : Math.min(Math.abs(t - r.from), Math.abs(t - r.to));
      f = Math.min(f, d === 0 ? 0 : smooth(d / 0.15));
    }
    return f;
  }
  function shakeOffset(sh, t) {
    var dt = t - sh.t;
    if (dt < 0 || dt > sh.decay * 1.6) return { x: 0, y: 0 };
    var env = Math.exp((-4 * dt) / sh.decay);
    return {
      x: sh.amp * env * (Math.sin(2 * Math.PI * 23 * dt + sh.ph[0]) + 0.5 * Math.sin(2 * Math.PI * 41 * dt + sh.ph[1])) / 1.5,
      y: sh.amp * env * (Math.sin(2 * Math.PI * 29 * dt + sh.ph[2]) + 0.5 * Math.sin(2 * Math.PI * 47 * dt + sh.ph[3])) / 1.5,
    };
  }
  /** The whole camera at t: keyed moves, then follow, handheld and shake summed. Returns what .world should show. */
  function camFull(t, noExtras) {
    var s = camBase(t);
    var z = Math.exp(s.zl);
    var x = s.x, y = s.y;
    if (!noExtras) {
      v2.follows.forEach(function (f) {
        var w = smooth((t - f.from) / 0.4) * smooth((f.to - t) / 0.4);
        if (w <= 0) return;
        var p = sampleAt(f, t + f.lead);
        x = lerp(x, -z * p.x, w);
        y = lerp(y, -z * p.y, w);
      });
      var rf = restFactor(t);
      v2.handhelds.forEach(function (h) {
        var w = smooth((t - h.from) / 0.4) * smooth((h.to - t) / 0.4) * rf;
        if (w <= 0) return;
        x += w * h.amount * (Math.sin(2 * Math.PI * 0.31 * t + h.ph[0]) + 0.6 * Math.sin(2 * Math.PI * 0.73 * t + h.ph[1]));
        y += w * h.amount * (Math.sin(2 * Math.PI * 0.27 * t + h.ph[2]) + 0.6 * Math.sin(2 * Math.PI * 0.67 * t + h.ph[3]));
      });
      v2.shakes.forEach(function (sh) {
        var o = shakeOffset(sh, t);
        x += o.x; y += o.y;
      });
    }
    return { x: x, y: y, z: z, r: s.r, tx: s.tx, ty: s.ty, keyed: s };
  }
  function applyCamera(t) {
    var w = document.querySelector(".world");
    if (!w) return;
    var c = camFull(t);
    w.style.transform = "translate3d(" + c.x + "px," + c.y + "px,0) rotateX(" + c.tx + "deg) rotateY(" + c.ty + "deg) rotate(" + c.r + "deg) scale(" + c.z + ")";
    var sz = size();
    v2.depth.forEach(function (d) {
      var k = (1 / (1 + d.depth) - 1) / c.z;
      d.el.style.translate = c.x * k + "px " + c.y * k + "px";
    });
    v2.grids.forEach(function (g) {
      var zd = Math.pow(c.z, 1 / (1 + g.depth));
      var sp = g.spacing * zd;
      while (sp > g.spacing * 2) sp /= 2;
      var ox = (c.x / (1 + g.depth) + sz.w / 2), oy = (c.y / (1 + g.depth) + sz.h / 2);
      g.el.style.backgroundSize = sp + "px " + sp + "px";
      g.el.style.backgroundPosition = ox + "px " + oy + "px";
    });
    v2.lod.forEach(function (l) {
      var screen = Math.max(l.w, l.h) * c.z;
      var opv = l.max > 0 ? smooth((screen - l.min * 0.8) / (l.min * 0.4 + 1e-6)) * smooth((l.max * 1.25 - screen) / (l.max * 0.5 + 1e-6)) : smooth((screen - l.min * 0.8) / (l.min * 0.4 + 1e-6));
      var cx = c.x + c.z * (l.cx - sz.w / 2) + sz.w / 2, cy = c.y + c.z * (l.cy - sz.h / 2) + sz.h / 2;
      var off = cx + (l.w * c.z) / 2 < 0 || cx - (l.w * c.z) / 2 > sz.w || cy + (l.h * c.z) / 2 < 0 || cy - (l.h * c.z) / 2 > sz.h;
      l.el.style.opacity = String(round3(opv));
      l.el.style.display = off || opv <= 0.001 ? "none" : "";
    });
  }
  function seekAll(t, withCamera) {
    applyDrivers(t);
    if (withCamera) applyCamera(t);
  }

  // ---- properties: friendly names → anime.js properties
  var TRANSFORMS = { x: "translateX", y: "translateY", z: "translateZ" };
  var TIMING = { duration: 1, delay: 1, ease: 1, stagger: 1, onRender: 1 };
  function wrapFn(v) {
    // our function values are (index, element) => value
    return typeof v === "function" ? function (el, i) { return v(i, el); } : v;
  }
  function mapValue(prop, v) {
    if (prop === "blur") {
      var px = function (b) { return "blur(" + b + "px)"; };
      if (typeof v === "function") return function (el, i) { return px(v(i, el)); };
      return px(v);
    }
    return wrapFn(v);
  }
  function mapProp(prop) {
    if (prop === "blur") return "filter";
    return TRANSFORMS[prop] || prop;
  }
  function params(vars, mode, fromVars) {
    var out = {};
    var keys = Object.keys(vars).filter(function (k) { return !TIMING[k]; });
    if (fromVars) keys = keys.concat(Object.keys(fromVars).filter(function (k) { return !TIMING[k] && keys.indexOf(k) < 0; }));
    keys.forEach(function (k) {
      var p = mapProp(k);
      if (mode === "from") out[p] = { from: mapValue(k, vars[k]) };
      else if (mode === "fromTo") out[p] = { from: mapValue(k, fromVars[k]), to: mapValue(k, vars[k]) };
      else out[p] = mapValue(k, vars[k]);
    });
    if (mode !== "set") {
      out.duration = Math.max(1, Math.round((vars.duration != null ? vars.duration : 0.6) * 1000));
      out.ease = ease(vars.ease);
      if (vars.delay) out.delay = Math.round(vars.delay * 1000);
    }
    if (vars.stagger != null) {
      var st = vars.stagger;
      if (typeof st === "number") out.delay = A.stagger(Math.round(st * 1000), vars.delay ? { start: Math.round(vars.delay * 1000) } : undefined);
      else out.delay = A.stagger(Math.round((st.each || 0.1) * 1000), { from: st.from || "first", start: Math.round((vars.delay || 0) * 1000) });
    }
    return out;
  }
  function count(targets) {
    if (typeof targets === "string") return document.querySelectorAll(targets).length;
    if (targets && typeof targets.length === "number") return targets.length;
    return targets ? 1 : 0;
  }
  function staggerSpan(vars, targets) {
    var n = count(targets);
    if (vars.stagger == null || n < 2) return 0;
    var each = typeof vars.stagger === "number" ? vars.stagger : vars.stagger.each || 0.1;
    return each * (n - 1);
  }

  function makeTimeline() {
    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "out(3)" } });
    var labels = {};
    var prevStart = 0, prevEnd = 0, end = 0;
    function at(position) {
      if (position == null) return end;
      if (typeof position === "number") return position;
      var p = String(position).trim();
      var m = /^(.*?)([+-]=)(-?[\d.]+)$/.exec(p);
      var base = m ? m[1] : p;
      var off = m ? (m[2] === "+=" ? 1 : -1) * parseFloat(m[3]) : 0;
      var t;
      if (base === "") t = end;
      else if (base === "<") t = prevStart;
      else if (base === ">") t = prevEnd;
      else if (labels.hasOwnProperty(base)) t = labels[base];
      else if (!isNaN(parseFloat(base))) t = parseFloat(base);
      else throw new Error('unknown position "' + position + '" (labels: ' + Object.keys(labels).join(", ") + ")");
      return Math.max(0, t + off);
    }
    function step(start, dur) {
      prevStart = start;
      prevEnd = start + dur;
      if (prevEnd > end) end = prevEnd;
    }
    function add(targets, vars, mode, position, fromVars) {
      var start = at(position);
      if (count(targets) === 0) throw new Error("no element matches " + JSON.stringify(String(targets)));
      var p = params(vars, mode, fromVars);
      if (p.filter !== undefined) {
        // filter: none can't be interpolated; start such elements from an explicit blur(0px).
        var list = typeof targets === "string" ? document.querySelectorAll(targets) : [].concat(targets);
        Array.prototype.forEach.call(list, function (el) { if (el && el.style && getComputedStyle(el).filter === "none") el.style.filter = "blur(0px)"; });
      }
      if (mode === "set") tl.set(targets, p, Math.round(start * 1000));
      else tl.add(targets, p, Math.round(start * 1000));
      var dur = mode === "set" ? 0 : (vars.duration != null ? vars.duration : 0.6) + (vars.delay || 0) + staggerSpan(vars, targets);
      step(start, dur);
    }

    // ---- version 2 verbs (all of them are drivers: pure functions of t, written after the timeline seeks)
    function addHit(name, t, kind, pan) {
      v2.hits.push({ name: name, t: round3(t), kind: kind || "impact", pan: pan || 0 });
    }
    function prog(t, start, dur, e) { return e(clamp01((t - start) / dur)); }
    function camMove(vars, pos) {
      var start = at(pos);
      var dur = vars.duration != null ? vars.duration : 1.2;
      var m = { start: start, dur: dur, easeFn: easeFn(vars.ease || "inOut(3)"), to: {} };
      if (vars.zoom != null) {
        if (!(vars.zoom > 0)) throw new Error("camera(): zoom must be above 0 (1 is the resting frame), got " + vars.zoom + ".");
        m.to.zl = Math.log(vars.zoom);
      }
      if (vars.rotate != null) m.to.r = vars.rotate;
      if (vars.tiltX != null) m.to.tx = vars.tiltX;
      if (vars.tiltY != null) m.to.ty = vars.tiltY;
      if (vars.x != null) m.to.x = vars.x;
      if (vars.y != null) m.to.y = vars.y;
      if (vars.anchor != null) {
        var el = one(vars.anchor, "camera", "anchor");
        var c = centerOf(layoutRect(el));
        var sz = size();
        var scr = vars.at || [50, 50];
        m.pin = { px: c.x - sz.w / 2, py: c.y - sz.h / 2, qx: (scr[0] / 100 - 0.5) * sz.w, qy: (scr[1] / 100 - 0.5) * sz.h };
      }
      v2.moves.push(m);
      step(start, dur);
      return m;
    }
    function morphImpl(from, to, vars, pos) {
      var F = one(from, "morph", "from"), T = one(to, "morph", "to");
      if (F === T) throw new Error('morph(): "from" and "to" are the same element. Morph carries one element into a different one.');
      var cs = getComputedStyle(F);
      if (cs.position === "static") throw new Error('morph(): "' + labelOf(from, F) + '" must be positioned (position:absolute or relative) so its box can animate. Add position:absolute to it.');
      vars = vars || {};
      var start = at(pos), d = vars.duration != null ? vars.duration : 0.9, e = easeFn(vars.ease || "inOut(3)");
      var rf = layoutRect(F), rt = layoutRect(T);
      var csT = getComputedStyle(T);
      var a0 = { l: parseFloat(cs.left) || 0, t: parseFloat(cs.top) || 0, w: parseFloat(cs.width) || rf.w, h: parseFloat(cs.height) || rf.h, r: parseFloat(cs.borderTopLeftRadius) || 0 };
      var a1 = { l: a0.l + (rt.x - rf.x), t: a0.t + (rt.y - rf.y), w: a0.w + (rt.w - rf.w), h: a0.h + (rt.h - rf.h), r: vars.radius === false ? a0.r : parseFloat(csT.borderTopLeftRadius) || 0 };
      var c0 = parseColor(cs.backgroundColor), c1 = parseColor(csT.backgroundColor);
      var kids = vars.content === "none" ? [] : Array.prototype.slice.call(T.children);
      var swap = start + d * 0.85, rise = start + d * 0.6, riseY = size().h * 0.015;
      v2.drivers.push({ start: start, end: start + d, apply: function (t) {
        var u = prog(t, start, d, e);
        F.style.left = lerp(a0.l, a1.l, u) + "px"; F.style.top = lerp(a0.t, a1.t, u) + "px";
        F.style.width = lerp(a0.w, a1.w, u) + "px"; F.style.height = lerp(a0.h, a1.h, u) + "px";
        F.style.borderRadius = lerp(a0.r, a1.r, u) + "px";
        var bg = mixColor(c0, c1, u);
        if (bg) F.style.backgroundColor = bg;
        var k = clamp01((t - swap) / (start + d - swap));
        op(F, 1 - k);
        op(T, k);
        var ru = e(clamp01((t - rise) / (start + d - rise)));
        kids.forEach(function (kid) { op(kid, ru); kid.style.translate = "0px " + (1 - ru) * riseY + "px"; });
      } });
      v2.carries.push({ from: labelOf(from, F), to: labelOf(to, T), start: round3(start), end: round3(start + d), kind: "morph" });
      addHit("morph", start + d, "land");
      step(start, d);
    }
    function irisImpl(target, opts, pos) {
      opts = opts || {};
      var T = one(target, "iris", "target"), Fr = one(opts.from, "iris", "from");
      var start = at(pos), d = opts.duration != null ? opts.duration : 0.9, e = easeFn(opts.ease || "inOut(3)");
      var cF = centerOf(layoutRect(Fr)), rT = layoutRect(T), sz = size();
      var cx = cF.x - rT.x, cy = cF.y - rT.y;
      var corners = [[0, 0], [sz.w, 0], [0, sz.h], [sz.w, sz.h], [rT.x, rT.y], [rT.x + rT.w, rT.y], [rT.x, rT.y + rT.h], [rT.x + rT.w, rT.y + rT.h]];
      var rEnd = Math.max.apply(null, corners.map(function (c) { return Math.hypot(c[0] - cF.x, c[1] - cF.y); })) + (opts.edge || 0);
      v2.drivers.push({ start: start, end: start + d, apply: function (t) {
        var u = prog(t, start, d, e);
        T.style.clipPath = u >= 1 ? "none" : "circle(" + u * rEnd + "px at " + cx + "px " + cy + "px)";
      } });
      v2.carries.push({ from: labelOf(opts.from, Fr), to: labelOf(target, T), start: round3(start), end: round3(start + d), kind: "iris" });
      step(start, d);
    }
    function zoomThroughImpl(target, opts, pos) {
      opts = opts || {};
      var el = one(target, "zoomThrough", "target");
      if (!el.closest(".world")) throw new Error('zoomThrough(): "' + labelOf(target, el) + '" must be inside <div class="world"> so the camera can move to it.');
      var r = layoutRect(el), sz = size();
      var zEnd = opts.fit === "contain" ? Math.min(sz.w / r.w, sz.h / r.h) : Math.max(sz.w / r.w, sz.h / r.h);
      var start = at(pos), d = opts.duration != null ? opts.duration : 1.2;
      var m = camMove({ anchor: el, at: [50, 50], zoom: zEnd, duration: d, ease: opts.ease || "inOut(3)" }, start);
      if (opts.into != null) {
        var inner = one(opts.into, "zoomThrough", "into");
        if (inner.closest(".world")) throw new Error('zoomThrough(): "into" must sit outside <div class="world"> (a direct child of the stage), because the camera is reset when it takes over.');
        var w = document.querySelector(".world"), t1 = start + d, t0 = start + d * 0.88;
        v2.moves.push({ start: t1, dur: 0.001, easeFn: easeFn("linear"), to: {}, resetOf: m });
        v2.drivers.push({ start: start, end: t1, apply: function (t) {
          op(inner, smooth((t - t0) / (t1 - t0)));
          w.style.visibility = t > t1 ? "hidden" : "visible";
        } });
        v2.carries.push({ from: labelOf(target, el), to: labelOf(opts.into, inner), start: round3(start), end: round3(t1), kind: "zoomThrough" });
      }
      step(start, d);
    }
    // A hop is measured from the element's resting layout position, so a second hop on the
    // same element starts from where the first one ended: `chain` holds the offset it has
    // already travelled. Transforms of one element add up, so each hop only adds its own leg.
    var chain = new Map(), poses = new Map(), shadows = new Map();
    function hopImpl(target, opts, pos) {
      opts = opts || {};
      var E = one(target, "hop", "target"), D = one(opts.to, "hop", "to");
      var start = at(pos), d = opts.duration != null ? opts.duration : 0.7, sq = opts.squash != null ? opts.squash : 0.18;
      var h = opts.height != null ? opts.height : size().h * 0.18;
      var prev = chain.get(E) || { x: 0, y: 0, end: -Infinity };
      if (start < prev.end - 1e-6) throw new Error('hop(): "' + labelOf(target, E) + '" is still in its previous hop until ' + round3(prev.end) + "s. Start this hop at or after that time.");
      var c0 = centerOf(layoutRect(E)), c1 = centerOf(layoutRect(D));
      var tx = c1.x - c0.x, ty = c1.y - c0.y;
      var dx = tx - prev.x, dy = ty - prev.y, ex = easeFn("inOut(2)");
      chain.set(E, { x: tx, y: ty, end: start + d });
      E.style.transformOrigin = "50% 100%";
      function pose(t) {
        var u = clamp01((t - start) / d);
        return { x: dx * ex(u), gy: dy * u, lift: 4 * h * u * (1 - u), u: u };
      }
      if (!poses.has(E)) poses.set(E, []);
      poses.get(E).push(pose);
      v2.drivers.push({ start: start, end: start + d, apply: function (t) {
        var p = pose(t), u = p.u;
        var k = u > 0.8 && u < 1 ? Math.sin(Math.PI * ((u - 0.8) / 0.2)) * sq : 0;
        tf(E, "translate(" + p.x + "px," + (p.gy - p.lift) + "px) scale(" + (1 + k * 0.6) + "," + (1 - k) + ")");
      } });
      v2.carries.push({ from: labelOf(target, E), to: labelOf(opts.to, D), start: round3(start), end: round3(start + d), kind: "hop" });
      addHit("hop", start + d * 0.9, "land");
      if (opts.shadow) shadowImpl(E, opts.shadow === true ? {} : opts.shadow);
      step(start, d);
    }
    /**
     * A contact shadow under an element: a soft ellipse on the ground below it. It follows
     * the element along the ground, grows faint and wide as the element lifts (hop arcs
     * are read automatically; `lift` sets a fixed height for a hovering element), and
     * fades with the element's own opacity.
     */
    function shadowImpl(target, opts) {
      opts = opts || {};
      var E = one(target, "shadow", "target");
      if (shadows.has(E)) return shadows.get(E);
      var r = layoutRect(E), parent = E.parentNode;
      var pr = layoutRect(parent);
      var w = (opts.width != null ? opts.width : 0.9) * r.w, hgt = (opts.height != null ? opts.height : 0.16) * r.w;
      var alpha = opts.opacity != null ? opts.opacity : 0.4, spread = opts.spread != null ? opts.spread : 0.9;
      var gap = opts.offset != null ? opts.offset : 0;
      var peak = opts.lift != null ? opts.lift : 0, ref = size().h * 0.18;
      var sh = document.createElement("div");
      sh.className = "stage-shadow";
      var cs = getComputedStyle(parent);
      if (cs.position === "static") throw new Error('shadow(): the parent of "' + describe(E) + '" must be positioned (position:absolute or relative) so the shadow can sit beside it.');
      sh.setAttribute("style", "position:absolute;pointer-events:none;left:" + (r.x - pr.x + r.w / 2 - w / 2) + "px;top:" + (r.y - pr.y + r.h - hgt / 2 + gap) + "px;width:" + w + "px;height:" + hgt + "px;border-radius:50%;background:radial-gradient(closest-side," + (opts.color || "rgba(0,0,0,1)") + " 0%,rgba(0,0,0,0) 100%);opacity:0;will-change:transform,opacity");
      parent.insertBefore(sh, E);
      shadows.set(E, sh);
      v2.drivers.push({ start: 0, end: Infinity, apply: function (t) {
        var gx = 0, gy = 0, lift = peak;
        (poses.get(E) || []).forEach(function (f) { var p = f(t); gx += p.x; gy += p.gy; lift += p.lift; });
        var k = clamp01(lift / (ref * 1.5));
        var s = 1 + k * spread * 0.6, a = alpha * (1 - 0.65 * k);
        var own = parseFloat(getComputedStyle(E).opacity);
        op(sh, a * (isNaN(own) ? 1 : own));
        tf(sh, "translate(" + gx + "px," + gy + "px) scale(" + s + "," + (1 + k * 0.3) + ")");
      } });
      return sh;
    }
    /**
     * Depth of field: every element carrying data-dof="<depth>" is blurred in proportion to
     * its distance from the focus depth. tl.focus("#el") focuses on that element's depth
     * (a number works too), and a later call racks the focus from there to the new depth.
     * tl.focus(null) puts everything back in focus. Blur is a filter on the element itself,
     * so keep it off containers that use transform-style: preserve-3d.
     */
    function focusImpl(target, opts, pos) {
      opts = opts || {};
      var depth = null;
      if (target != null && target !== false && target !== "off") {
        if (typeof target === "number") depth = target;
        else {
          var f = one(target, "focus", "target");
          depth = parseFloat(f.getAttribute("data-dof"));
          if (isNaN(depth)) throw new Error('focus(): "' + labelOf(target, f) + '" has no data-dof depth. Give it data-dof="<number>" (the depth it sits at), or pass a number.');
        }
      }
      var start = at(pos), d = opts.duration != null ? opts.duration : 0.6;
      v2.focus.push({ start: start, dur: d, easeFn: easeFn(opts.ease || "inOut(2)"), depth: depth, blur: opts.blur != null ? opts.blur : 8, max: opts.max != null ? opts.max : 28 });
      if (!v2.focusEls) {
        var els = Array.prototype.slice.call(root().querySelectorAll("[data-dof]"));
        if (!els.length) throw new Error('focus(): no element has data-dof. Mark the layers that should blur, for example <div data-dof="2">, nearer layers with smaller numbers.');
        v2.focusEls = els.map(function (el) { return { el: el, depth: parseFloat(el.getAttribute("data-dof")) || 0, base: el.style.filter || "" }; });
        v2.drivers.push({ start: 0, end: Infinity, apply: focusApply });
      }
      step(start, d);
    }
    function focusApply(t) {
      var keys = v2.focus.slice().sort(function (a, b) { return a.start - b.start; });
      var st = { depth: null, blur: 0, max: 28 };
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (t < k.start) break;
        var u = k.easeFn(clamp01((t - k.start) / k.dur));
        var td = k.depth === null ? st.depth : k.depth, tb = k.depth === null ? 0 : k.blur;
        st = { depth: st.depth === null || td === null ? td : lerp(st.depth, td, u), blur: lerp(st.blur, tb, u), max: k.max };
        if (u < 1) break;
      }
      v2.focusEls.forEach(function (it) {
        var b = st.depth === null ? 0 : Math.min(st.max, Math.abs(it.depth - st.depth) * st.blur);
        var f = b > 0.05 ? "blur(" + round3(b) + "px)" : "";
        it.el.style.filter = (it.base + " " + f).trim();
      });
    }
    function gatherImpl(targets, opts, pos) {
      opts = opts || {};
      var list = many(targets, "gather", "targets"), D = one(opts.into, "gather", "into");
      var start = at(pos), d = opts.duration != null ? opts.duration : 0.8, arc = opts.arc != null ? opts.arc : 0.25, stag = opts.stagger != null ? opts.stagger : 0.06, spin = opts.spin || 0;
      var box = layoutRect(D), cols = Math.ceil(Math.sqrt(list.length)), rows = Math.ceil(list.length / cols), e = easeFn("inOut(2)");
      var items = list.map(function (el, i) {
        var r = layoutRect(el), c0 = centerOf(r);
        var col = i % cols, row = Math.floor(i / cols);
        var tx = box.x + ((col + 0.5) / cols) * box.w, ty = box.y + ((row + 0.5) / rows) * box.h;
        tx = Math.min(Math.max(tx, box.x + Math.min(r.w, box.w) / 2), box.x + box.w - Math.min(r.w, box.w) / 2);
        ty = Math.min(Math.max(ty, box.y + Math.min(r.h, box.h) / 2), box.y + box.h - Math.min(r.h, box.h) / 2);
        var dx = tx - c0.x, dy = ty - c0.y, dist = Math.hypot(dx, dy) || 1, sgn = i % 2 ? -1 : 1;
        return { el: el, dx: dx, dy: dy, ox: (-dy / dist) * arc * dist * sgn, oy: (dx / dist) * arc * dist * sgn, delay: i * stag };
      });
      var span = d + stag * (list.length - 1);
      v2.drivers.push({ start: start, end: start + span, apply: function (t) {
        items.forEach(function (it) {
          var u = clamp01((t - start - it.delay) / d), s = e(u);
          var cx = 0.5 * it.dx + 2 * it.ox, cy = 0.5 * it.dy + 2 * it.oy; // quadratic Bezier control point
          var x = 2 * s * (1 - s) * cx + s * s * it.dx, y = 2 * s * (1 - s) * cy + s * s * it.dy;
          tf(it.el, "translate(" + x + "px," + y + "px) rotate(" + spin * s + "deg)");
        });
      } });
      list.forEach(function (el) { v2.carries.push({ from: labelOf(targets, el), to: labelOf(opts.into, D), start: round3(start), end: round3(start + span), kind: "gather" }); });
      addHit("gather", start + span, "land");
      step(start, span);
    }
    function squashDriver(el, start, d, sq, depress) {
      var sp = springEase(0.5, 14);
      v2.drivers.push({ start: start, end: start + d, apply: function (t) {
        var u = clamp01((t - start) / d), k;
        if (depress) k = u < 0.2 ? easeFn("outQuad")(u / 0.2) : 1 - sp((u - 0.2) / 0.8);
        else k = u < 0.25 ? easeFn("outQuad")(u / 0.25) : 1 - sp((u - 0.25) / 0.75);
        var sx = depress ? 1 - k * sq : 1 + k * sq * 0.5, sy = depress ? 1 - k * sq : 1 - k * sq;
        tf(el, u >= 1 ? "scale(1,1)" : "scale(" + sx + "," + sy + ")");
      } });
    }
    function impactImpl(target, pos, opts) {
      opts = opts || {};
      many(target, "impact", "target").forEach(function (el) { squashDriver(el, at(pos), opts.duration != null ? opts.duration : 0.5, opts.squash != null ? opts.squash : 0.12, false); });
      var t0 = at(pos);
      addHit("impact", t0, "impact");
      step(t0, opts.duration != null ? opts.duration : 0.5);
    }
    function pressImpl(target, t0) {
      many(target, "press", "target").forEach(function (el) { squashDriver(el, t0, 0.38, 0.06, true); });
      addHit("press", t0, "click");
      step(t0, 0.38);
    }
    function pointerImpl(opts) {
      opts = opts || {};
      var path = (opts.path || []).slice().sort(function (a, b) { return a.t - b.t; });
      if (path.length < 2) throw new Error("pointer(): path needs at least two knots, { t, x, y } in stage pixels (use S.w / S.h).");
      var clicks = opts.clicks || [];
      var r = root();
      var cur = document.createElement("div");
      cur.className = "stage-pointer";
      cur.setAttribute("style", "position:absolute;left:0;top:0;width:" + size().h * 0.032 + "px;height:" + size().h * 0.032 + "px;z-index:2147483000;pointer-events:none;transform-origin:0 0;will-change:transform");
      cur.innerHTML = opts.look === "dot"
        ? '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="7" fill="#fff" stroke="#111" stroke-width="2"/></svg>'
        : '<svg viewBox="0 0 20 28" width="100%" height="100%"><path d="M2 2 L2 22 L7 17 L11 26 L14 25 L10 16 L17 16 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>';
      r.appendChild(cur);
      var n = path.length;
      function tangent(i, k) {
        var a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)], dt = b.t - a.t || 1;
        return (b[k] - a[k]) / dt;
      }
      function at2(t, k) {
        if (t <= path[0].t) return path[0][k];
        if (t >= path[n - 1].t) return path[n - 1][k];
        var i = 0;
        while (path[i + 1].t < t) i++;
        var p0 = path[i], p1 = path[i + 1], h = p1.t - p0.t, u = (t - p0.t) / h;
        var u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * p0[k] + (u3 - 2 * u2 + u) * h * tangent(i, k) + (-2 * u3 + 3 * u2) * p1[k] + (u3 - u2) * h * tangent(i + 1, k);
      }
      v2.pointers.push({ el: cur, path: path, clicks: clicks });
      v2.drivers.push({ start: path[0].t, end: path[n - 1].t, apply: function (t) {
        var sc = 1;
        clicks.forEach(function (c) { var w = (t - (c - 0.04)) / 0.16; if (w > 0 && w < 1) sc = Math.min(sc, 1 - 0.25 * Math.sin(Math.PI * w)); });
        tf(cur, "translate(" + at2(t, "x") + "px," + at2(t, "y") + "px) scale(" + sc + ")");
        cur.setAttribute("data-x", String(at2(t, "x")));
        cur.setAttribute("data-y", String(at2(t, "y")));
      } });
      clicks.forEach(function (c) { addHit("click", c, "click"); });
      step(path[0].t, path[n - 1].t - path[0].t);
    }
    function followImpl(target, opts, pos) {
      opts = opts || {};
      var el = one(target, "follow", "target");
      v2.follows.push({ el: el, lead: opts.lead != null ? opts.lead : 0.1, from: opts.from != null ? opts.from : at(pos), to: opts.to != null ? opts.to : Infinity });
    }
    function whipImpl(target, opts, pos) {
      opts = opts || {};
      camMove({ anchor: target, at: [50, 50], duration: opts.duration != null ? opts.duration : 0.45, ease: "inOutExpo" }, pos);
      addHit("whip", at(pos), "whoosh");
    }
    function handheldImpl(opts, from, to) {
      opts = opts || {};
      var r = seeded(7);
      v2.handhelds.push({ amount: opts.amount != null ? opts.amount : size().h * 0.0035, from: at(from), to: at(to), ph: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28] });
    }
    function shakeImpl(pos, opts) {
      opts = opts || {};
      var r = seeded(opts.seed != null ? opts.seed : 1), t0 = at(pos);
      v2.shakes.push({ t: t0, amp: opts.amp != null ? opts.amp : size().h * 0.012, decay: opts.decay != null ? opts.decay : 0.35, ph: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28] });
      addHit("shake", t0, "shake");
    }
    function restImpl(from, to, opts) {
      v2.rests.push({ from: at(from), to: at(to), allow: (opts && opts.allow) || [] });
    }

    var api = {
      to: function (t, vars, pos) { add(t, vars || {}, "to", pos); return api; },
      from: function (t, vars, pos) { add(t, vars || {}, "from", pos); return api; },
      fromTo: function (t, fromVars, toVars, pos) { add(t, toVars || {}, "fromTo", pos, fromVars || {}); return api; },
      set: function (t, vars, pos) { add(t, vars || {}, "set", pos); return api; },
      label: function (name, pos) { labels[name] = at(pos); return api; },
      /** Move the camera: the .world layer (x, y, zoom, rotate, tiltX, tiltY). */
      camera: function (vars, pos) {
        var w = document.querySelector(".world");
        if (!w) throw new Error('camera() needs a <div class="world"> wrapping the scene');
        if (v2) { camMove(vars, pos); return api; }
        if (vars.anchor != null || vars.at != null) need2("camera({ anchor })");
        var v = {};
        Object.keys(vars).forEach(function (k) {
          if (k === "zoom") v.scale = vars[k];
          else if (k === "tiltX") v.rotateX = vars[k];
          else if (k === "tiltY") v.rotateY = vars[k];
          else v[k] = vars[k];
        });
        if (v.duration == null) v.duration = 1.2;
        if (!v.ease) v.ease = "inOut(3)";
        add(w, v, "to", pos);
        return api;
      },
      morph: function (from, to, vars, pos) { need2("morph"); morphImpl(from, to, vars, pos); return api; },
      iris: function (target, opts, pos) { need2("iris"); irisImpl(target, opts, pos); return api; },
      zoomThrough: function (target, opts, pos) { need2("zoomThrough"); zoomThroughImpl(target, opts, pos); return api; },
      hop: function (target, opts, pos) { need2("hop"); hopImpl(target, opts, pos); return api; },
      /** Paint something on every seek as a pure function of the time (a canvas, say): fn(t) gets the time in seconds. */
      frame: function (fn) {
        need2("frame");
        if (typeof fn !== "function") throw new Error("frame(): pass a function (t) => void that paints the frame for time t.");
        v2.drivers.push({ start: 0, end: Infinity, apply: fn });
        return api;
      },
      shadow: function (target, opts) { need2("shadow"); shadowImpl(target, opts); return api; },
      focus: function (target, opts, pos) { need2("focus"); focusImpl(target, opts, pos); return api; },
      gather: function (targets, opts, pos) { need2("gather"); gatherImpl(targets, opts, pos); return api; },
      impact: function (target, pos, opts) { need2("impact"); impactImpl(target, pos, opts); return api; },
      press: function (target, t) { need2("press"); pressImpl(target, t); return api; },
      pointer: function (opts) { need2("pointer"); pointerImpl(opts); return api; },
      follow: function (target, opts, pos) { need2("follow"); followImpl(target, opts, pos); return api; },
      whip: function (target, opts, pos) { need2("whip"); whipImpl(target, opts, pos); return api; },
      handheld: function (opts, from, to) { need2("handheld"); handheldImpl(opts, from, to); return api; },
      shake: function (pos, opts) { need2("shake"); shakeImpl(pos, opts); return api; },
      hit: function (name, pos, opts) { need2("hit"); addHit(name, at(pos), opts && opts.kind, opts && opts.pan); return api; },
      rest: function (from, to, opts) { need2("rest"); restImpl(from, to, opts); return api; },
      cut: function (pos) { need2("cut"); v2.cuts.push(round3(at(pos))); return api; },
      get duration() { return end; },
      get labels() { return labels; },
      _anime: tl,
    };
    return api;
  }


  function gridImpl(opts) {
    opts = opts || {};
    var r = root(), sz = size();
    var depth = opts.depth != null ? opts.depth : 0.5, spacing = opts.spacing != null ? opts.spacing : Math.min(sz.w, sz.h) * 0.06, dot = opts.dot != null ? opts.dot : 2;
    var el = document.createElement("div");
    el.className = "stage-grid";
    el.setAttribute("style", "position:absolute;inset:0;pointer-events:none;opacity:" + (opts.opacity != null ? opts.opacity : 0.22) + ";background-image:radial-gradient(circle," + (opts.color || "currentColor") + " " + dot / 2 + "px,transparent " + (dot / 2 + 0.5) + "px)");
    r.insertBefore(el, r.firstChild);
    v2.grids.push({ el: el, depth: depth, spacing: spacing });
  }
  function pointerPathImpl(log) {
    var path = [], clicks = [];
    (log || []).forEach(function (e) {
      path.push({ t: e.t, x: e.x, y: e.y });
      if (e.type === "click" || e.type === "down") clicks.push(e.t);
    });
    return { path: path, clicks: clicks };
  }

  // ---- helpers handed to the author
  function seeded(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /**
   * Split an element's text into spans (words or chars), keeping spaces and
   * any child elements (an <em> keeps its own words, as spans inside it).
   * Returns the spans, in reading order.
   */
  function split(target, by) {
    var els = typeof target === "string" ? Array.prototype.slice.call(document.querySelectorAll(target)) : [].concat(target);
    var out = [];
    function splitText(node) {
      var parts = by === "chars" ? node.data.split("") : node.data.split(/(\s+)/);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement("span");
        s.className = by === "chars" ? "char" : "word";
        s.style.display = "inline-block";
        s.textContent = part;
        frag.appendChild(s);
        out.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    }
    function walk(el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3) splitText(n);
        else if (n.nodeType === 1 && !/^(SCRIPT|STYLE|SVG)$/i.test(n.nodeName)) walk(n);
      });
    }
    els.forEach(walk);
    return out;
  }
  function makeS() {
    var sz = size();
    var r = root();
    var beats = [];
    try { beats = JSON.parse(r.getAttribute("data-beats") || "[]"); } catch (e) {}
    var downbeats = [];
    try { downbeats = JSON.parse(r.getAttribute("data-downbeats") || "[]"); } catch (e) {}
    return {
      width: sz.w,
      height: sz.h,
      w: function (p) { return (p / 100) * sz.w; },
      h: function (p) { return (p / 100) * sz.h; },
      min: function (p) { return (p / 100) * Math.min(sz.w, sz.h); },
      portrait: sz.h > sz.w,
      rand: seeded,
      split: split,
      beats: beats,
      downbeats: downbeats,
      /** An element's resting box { x, y, w, h } in stage pixels (version 2). */
      rect: function (el) { return layoutRect(one(el, "S.rect", "element")); },
      /** An element's resting centre { x, y } in stage pixels (version 2). */
      center: function (el) { return centerOf(layoutRect(one(el, "S.center", "element"))); },
      /** A faint dot lattice behind the scene that keeps its dot size at any zoom (version 2). */
      grid: function (opts) { need2("S.grid"); gridImpl(opts); },
      /** Turn a recorded click log [{ t, x, y, type }] (seconds, stage pixels) into pointer({ path, clicks }) (version 2). */
      pointerPath: function (log) { return pointerPathImpl(log); },
      /** The time of beat n (seconds), or n × 0.5 s without a beat grid. */
      downbeat: function (n) { return downbeats.length ? downbeats[Math.min(downbeats.length - 1, Math.max(0, n))] : n * 2; },
      beat: function (n) { return beats.length ? beats[Math.min(beats.length - 1, Math.max(0, n))] : n * 0.5; },
    };
  }

  function fail(err) {
    var r = root();
    var msg = (err && err.message) || String(err);
    r.setAttribute("data-stage-error", msg);
    var box = document.createElement("div");
    box.setAttribute("style", "position:absolute;left:4%;top:4%;right:4%;padding:2%;background:#b00020;color:#fff;font:600 2.4vmin system-ui;z-index:2147483647;white-space:pre-wrap");
    box.textContent = "Sequence error: " + msg;
    r.appendChild(box);
  }

  function loadFonts() {
    if (!document.fonts) return Promise.resolve();
    var loads = [];
    document.fonts.forEach(function (f) { loads.push(f.load().catch(function () {})); });
    return Promise.all(loads).then(function () { return document.fonts.ready; });
  }


  function seekRaw(a, t) {
    a.seek(0);
    a.seek(Math.max(0, t) * 1000);
  }
  /** After the author's build function: settle the camera, run the follow pre-pass, check rests, publish what the stage knows. */
  function finishV2(tl, r) {
    var a = tl._anime, sz = size(), world = document.querySelector(".world");
    finalizeCamera();
    // depth layers and level-of-detail elements, measured at rest
    Array.prototype.forEach.call(document.querySelectorAll(".world [data-depth]"), function (el) {
      var d = parseFloat(el.getAttribute("data-depth"));
      if (d) v2.depth.push({ el: el, depth: d });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-lod]"), function (el) {
      var parts = (el.getAttribute("data-lod") || "").split(",").map(parseFloat);
      var rc = layoutRect(el);
      v2.lod.push({ el: el, min: parts[0] || 0, max: parts[1] || 0, w: rc.w, h: rc.h, cx: rc.x + rc.w / 2, cy: rc.y + rc.h / 2 });
    });
    // follow: sample each target's motion with the camera set aside
    if (v2.follows.length && !world) throw new Error('follow() needs a <div class="world"> wrapping the scene');
    v2.follows.forEach(function (f) {
      if (f.to === Infinity) f.to = tl.duration;
      f.t0 = f.from;
      f.pts = [];
      var n = Math.ceil((f.to + f.lead - f.from) * 60) + 1;
      var saved = world.style.transform;
      world.style.transform = "none";
      for (var i = 0; i < n; i++) {
        var t = f.t0 + i / 60;
        seekRaw(a, t);
        applyDrivers(t);
        var c = liveCenter(f.el);
        f.pts.push({ x: c.x - sz.w / 2, y: c.y - sz.h / 2 });
      }
      world.style.transform = saved;
    });
    // declared rests: nothing inside the world may move, apart from what the rest allows
    v2.rests.forEach(function (rest) {
      var moved = {}, first = null, any = false;
      var n = Math.max(2, Math.min(80, Math.ceil((rest.to - rest.from) / 0.1) + 1));
      for (var i = 0; i < n; i++) {
        var t = rest.from + ((rest.to - rest.from) * i) / (n - 1);
        seekRaw(a, t);
        seekAll(t, true);
        var snap = Array.prototype.map.call(document.querySelectorAll(".world *"), function (el) { return el.getAttribute("style") || ""; });
        var cam = JSON.stringify(camFull(t));
        if (!first) { first = { snap: snap, cam: cam }; continue; }
        if (cam !== first.cam) any = moved["the camera"] = true;
        var els = document.querySelectorAll(".world *");
        snap.forEach(function (st, k) {
          if (st === first.snap[k]) return;
          var el = els[k];
          var allowed = rest.allow.some(function (sel) {
            var list = typeof sel === "string" ? document.querySelectorAll(sel) : [sel];
            return Array.prototype.some.call(list, function (x) { return x === el || x.contains(el); });
          });
          if (!allowed) { moved[describe(el)] = true; any = true; }
        });
      }
      if (any) throw new Error("rest " + rest.from.toFixed(2) + "–" + rest.to.toFixed(2) + " s: " + Object.keys(moved).slice(0, 4).join(", ") + " still moves. Finish the move before the rest, shorten the rest, or list the element in { allow: [...] }.");
    });
    seekRaw(a, 0);
    r.setAttribute("data-stage-carries", JSON.stringify(v2.carries));
    r.setAttribute("data-stage-events", JSON.stringify(v2.hits.slice().sort(function (x, y) { return x.t - y.t; })));
    r.setAttribute("data-stage-rests", JSON.stringify(v2.rests.map(function (x) { return { from: round3(x.from), to: round3(x.to) }; })));
    r.setAttribute("data-stage-cuts", JSON.stringify(v2.cuts));
  }


  // ---- the shot check: the kit owns the timeline, so it can measure its own boundaries.
  // Labels are the beats; boxes come from getBoundingClientRect at the same seek the renderer uses.
  var PROBE_SKIP = /^(SCRIPT|STYLE|HEAD|META|LINK|BR|TITLE|NOSCRIPT)$/;
  function effectiveOpacity(el, stop) {
    var o = 1;
    for (var n = el; n && n !== stop.parentNode && n.nodeType === 1; n = n.parentNode) {
      var cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      // An iris that has not opened yet clips its target to nothing: it is on the page but not on screen.
      if (/^circle\(0(px)?[ )]/.test(cs.clipPath || "")) return 0;
      o *= parseFloat(cs.opacity);
    }
    return o;
  }
  function paints(el, cs) {
    if (/^(IMG|SVG|CANVAS|VIDEO)$/i.test(el.nodeName)) return true;
    var bg = parseColor(cs.backgroundColor);
    if ((bg && bg.a > 0.05) || (cs.backgroundImage && cs.backgroundImage !== "none")) return true;
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && (parseColor(cs.borderTopColor) || { a: 1 }).a > 0.05) return true;
    for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3 && /\S/.test(el.childNodes[i].data)) return true;
    return false;
  }
  var probeIds = null;
  function idOf(el) {
    if (!probeIds) probeIds = new Map();
    if (!probeIds.has(el)) probeIds.set(el, probeIds.size);
    return probeIds.get(el);
  }
  /** Every visible painted element's screen box (effective opacity above 0.05, at least partly on stage), keyed by identity. */
  function visibleBoxes(rootEl) {
    var r0 = rootEl.getBoundingClientRect();
    var out = [];
    var all = rootEl.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (PROBE_SKIP.test(el.nodeName) || el.classList.contains("stage-grid") || el.classList.contains("stage-pointer")) continue;
      var cs = getComputedStyle(el);
      if (!paints(el, cs)) continue;
      var op = effectiveOpacity(el, rootEl);
      if (op <= 0.05) continue;
      var rc = el.getBoundingClientRect();
      var x = rc.left - r0.left, y = rc.top - r0.top;
      if (rc.width <= 0 || rc.height <= 0) continue;
      if (x + rc.width <= 0 || y + rc.height <= 0 || x >= r0.width || y >= r0.height) continue;
      out.push({ id: idOf(el), el: el, name: describe(el), x: x, y: y, w: rc.width, h: rc.height, opacity: Math.round(op * 1000) / 1000 });
    }
    return out;
  }
  function seekPublic(t) { return window.__miraiclipSeek(t); }
  function cameraAt(world) {
    if (!world) return { x: 0, y: 0, z: 1 };
    var m = new DOMMatrix(getComputedStyle(world).transform);
    return { x: m.m41, y: m.m42, z: Math.hypot(m.m11, m.m12) };
  }
  function boundaryTimes(labels, duration, cuts) {
    var ts = [];
    Object.keys(labels).forEach(function (k) { if (labels[k] > 0.3 && labels[k] < duration) ts.push({ name: k, t: labels[k] }); });
    ts.sort(function (a, b) { return a.t - b.t; });
    var out = [];
    ts.forEach(function (b) { if (!out.length || b.t - out[out.length - 1].t > 0.05) out.push(b); });
    return out;
  }
  function probe(tl, r, opts) {
    opts = opts || {};
    var world = document.querySelector(".world");
    var res = {};
    if (opts.times) {
      res.frames = opts.times.map(function (t) {
        seekPublic(t);
        return { t: t, camera: cameraAt(world), items: visibleBoxes(r).map(function (b) { return { id: b.id, name: b.name, x: b.x, y: b.y, w: b.w, h: b.h, opacity: b.opacity }; }) };
      });
    }
    if (opts.report !== false && !opts.times) res.report = shotReport(tl, r, opts);
    return res;
  }
  function shotReport(tl, r, opts) {
    var W = r.clientWidth || window.innerWidth, H = r.clientHeight || window.innerHeight;
    var diag = Math.hypot(W, H), area = W * H, dur = tl.duration;
    var declared = parseFloat(r.getAttribute("data-duration") || "0") || dur;
    var world = document.querySelector(".world");
    var cuts = v2 ? v2.cuts : [], rests = v2 ? v2.rests : [], carries = v2 ? v2.carries : [];
    var B = boundaryTimes(tl.labels, declared, cuts);
    var WIN = opts.window != null ? opts.window : 0.2;
    var findings = [];
    function add(rule, severity, message, hint, t) { findings.push({ rule: rule, severity: severity, t: t === undefined ? null : round3(t), message: message, hint: hint || "" }); }

    // burst: three or more boundaries inside 1.5 s
    var inBurst = B.map(function (b, i) {
      for (var s = 0; s < B.length; s++) {
        var n = 0;
        for (var j = s; j < B.length && B[j].t - B[s].t <= 1.5; j++) { n++; }
        if (n >= 3 && i >= s && i < s + n) return true;
      }
      return false;
    });

    var boundaries = B.map(function (b, i) {
      var line = { label: b.name, t: round3(b.t), kind: "", survivor: null, note: "" };
      var cut = cuts.some(function (c) { return Math.abs(c - b.t) <= WIN; });
      if (cut) { line.kind = "exempt"; line.note = "cut"; return line; }
      if (inBurst[i]) { line.kind = "exempt"; line.note = "burst"; return line; }
      if (b.t > declared - 1.2) { line.kind = "exempt"; line.note = "end"; return line; }
      var tA = Math.max(0, b.t - WIN), tB = Math.min(declared, b.t + WIN);
      seekPublic(tA);
      var A = visibleBoxes(r), camA = cameraAt(world);
      seekPublic(tB);
      var Bx = visibleBoxes(r), camB = cameraAt(world);
      var byId = {};
      A.forEach(function (x) { byId[x.id] = x; });
      var survivors = [];
      Bx.forEach(function (x) {
        var a0 = byId[x.id];
        if (!a0) return;
        var move = Math.hypot(x.x + x.w / 2 - (a0.x + a0.w / 2), x.y + x.h / 2 - (a0.y + a0.h / 2));
        var ratio = Math.max(x.w / a0.w, a0.w / x.w, x.h / a0.h, a0.h / x.h);
        var cover = Math.max(x.w * x.h, a0.w * a0.h) / area;
        survivors.push({ name: x.name, moves: move >= 0.02 * diag || ratio >= 1.1, big: cover >= 0.03 && cover < 0.85, cover: cover });
      });
      // a carry verb that hands one element over to another inside the window
      var pair = carries.filter(function (c) { return c.start <= tB && c.end >= tA; })[0];
      var camMoves = Math.hypot(camB.x - camA.x, camB.y - camA.y) >= 0.02 * diag || Math.max(camB.z / camA.z, camA.z / camB.z) >= 1.02;
      var real = survivors.filter(function (x) { return x.cover < 0.85; });
      var mover = real.filter(function (x) { return x.moves; })[0];
      var still = real.filter(function (x) { return !x.moves && x.big; })[0];
      if (pair) { line.kind = "carried"; line.survivor = pair.from + " → " + pair.to; }
      else if (mover) { line.kind = "carried"; line.survivor = mover.name; }
      else if (camMoves && real.length) { line.kind = "carried"; line.survivor = "the camera carries " + real[0].name; }
      else if (still) { line.kind = "anchored"; line.survivor = still.name; }
      else {
        line.kind = "bare";
        var gone = A.filter(function (x) { return !Bx.some(function (y) { return y.id === x.id; }); }).sort(function (p, q) { return q.w * q.h - p.w * p.h; })[0];
        var came = Bx.filter(function (x) { return !byId[x.id]; }).sort(function (p, q) { return q.w * q.h - p.w * p.h; })[0];
        line.gone = gone ? gone.name : null;
        line.came = came ? came.name : null;
        line.hint = gone && came ? 'carry it over: tl.morph("' + gone.name + '", "' + came.name + '") or tl.hop("' + gone.name + '", { to: "' + came.name + '" })' : came ? "something must survive into this beat: keep an element from the last beat on screen and move or scale it into " + came.name : "nothing survives into this beat";
      }
      return line;
    });

    var scored = boundaries.filter(function (x) { return x.kind !== "exempt"; });
    var carried = scored.filter(function (x) { return x.kind === "carried"; }).length;
    var anchored = scored.filter(function (x) { return x.kind === "anchored"; }).length;
    var score = scored.length ? round3((carried + anchored / 2) / scored.length) : null;
    boundaries.forEach(function (x) {
      if (x.kind === "bare") add("bare-boundary", "warning", "nothing survives the beat at " + x.t.toFixed(2) + " s (" + x.label + "): " + (x.gone || "the last beat") + " is replaced by " + (x.came || "a new one"), x.hint, x.t);
    });
    if (score !== null && score < 0.5) add("carry-score", "warning", "carry score " + score.toFixed(2) + " is under 0.50: most beats start from nothing", "make something from each beat become the next (tl.morph, tl.hop, tl.zoomThrough, tl.gather)");

    // coverage
    var coverage = { labels: B.length, boundaries: scored.length, enough: true };
    if (!Object.keys(tl.labels).length) { coverage.enough = false; add("coverage", "warning", "no labels: the check has no beats to look at", "mark each beat with tl.label(name, time)"); }
    else if (B.length < declared / 4) { coverage.enough = false; add("coverage", "warning", "only " + B.length + " beat boundaries in " + declared.toFixed(1) + " s: too few for the score to mean anything", "label every beat; aim for one every 4 s or less"); }

    // framing
    var framing = [];
    var subjects = r.querySelectorAll("[data-keep-in-frame]");
    if (subjects.length) {
      var step = 1 / 60;
      Array.prototype.forEach.call(subjects, function (el) {
        var parts = (el.getAttribute("data-keep-in-frame") || "").split(",").map(function (x) { return x.trim(); });
        var t0 = parseFloat(parts[0]) || 0, t1 = parts[1] !== undefined && parts[1] !== "" ? parseFloat(parts[1]) : declared, whole = parts[2] === "whole";
        var first = null, last = null, count = 0;
        for (var t = t0; t <= t1 + 1e-9; t += step) {
          seekPublic(t);
          var rc = el.getBoundingClientRect(), r0 = r.getBoundingClientRect();
          var x = rc.left - r0.left, y = rc.top - r0.top;
          var op = effectiveOpacity(el, r);
          var off = op <= 0.05 || x + rc.width <= 0 || y + rc.height <= 0 || x >= W || y >= H;
          var cut = whole && !off && (x < -0.5 || y < -0.5 || x + rc.width > W + 0.5 || y + rc.height > H + 0.5);
          if (off || cut) { if (first === null) first = t; last = t; count++; }
        }
        if (first !== null) {
          var item = { subject: describe(el), from: round3(first), to: round3(last), kind: whole ? "cut off" : "out of frame" };
          framing.push(item);
          add("framing", "warning", item.subject + " is " + item.kind + " from " + item.from.toFixed(2) + " s" + (last > first + step ? " to " + item.to.toFixed(2) + " s" : ""), whole ? "keep the whole subject inside the frame, or loosen data-keep-in-frame" : "keep the subject in frame, or follow it with the camera (tl.follow)", first);
        }
      });
    }

    // rhythm
    var marks = [0].concat(B.map(function (b) { return b.t; }), [declared]);
    var shots = [];
    for (var k = 1; k < marks.length; k++) shots.push(round3(marks[k] - marks[k - 1]));
    var mean = shots.reduce(function (a, b) { return a + b; }, 0) / (shots.length || 1);
    var sd = Math.sqrt(shots.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (shots.length || 1));
    var cv = mean ? round3(sd / mean) : 0;
    var restTotal = rests.reduce(function (a, x) { return a + (x.to - x.from); }, 0);
    var burstCount = 0;
    for (var q = 0; q < B.length; q++) if (inBurst[q] && (q === 0 || !inBurst[q - 1])) burstCount++;
    var lone = cuts.filter(function (c) {
      var nearBurst = B.some(function (b, i) { return inBurst[i] && Math.abs(b.t - c) <= 1.5; });
      return !nearBurst && c < declared - 1.2;
    });
    var rhythm = { shots: shots, cv: cv, restShare: round3(restTotal / declared), rests: rests.length, bursts: burstCount, hardCuts: cuts.length, cutsOutsideBursts: lone };
    if (shots.length >= 4 && cv < 0.25) add("cadence", "warning", "the beats are evenly spaced (variation " + cv.toFixed(2) + ", under 0.25): it reads as a metronome", "vary the shot lengths: hold some beats, rush others");
    lone.forEach(function (c) { add("hard-cut", "warning", "a hard cut at " + c.toFixed(2) + " s outside a burst", "hide the cut inside a move (tl.zoomThrough, tl.whip) or take it out", c); });

    return { version: v2 ? 2 : 1, events: v2 ? v2.hits.slice().sort(function (x, y) { return x.t - y.t; }) : [], duration: round3(declared), labels: tl.labels, score: score, carried: carried, anchored: anchored, bare: scored.length - carried - anchored, exempt: boundaries.length - scored.length, boundaries: boundaries, coverage: coverage, framing: framing, rhythm: rhythm, findings: findings };
  }

  var built = false;
  window.stage = {
    build: function (fn) {
      if (built) { fail(new Error("stage.build() can only be called once")); return; }
      built = true;
      var whenLoaded = document.readyState === "complete" ? Promise.resolve() : new Promise(function (r) { window.addEventListener("load", r); });
      whenLoaded.then(loadFonts).then(function () {
        var r0 = root();
        v2 = r0.getAttribute("data-stage-version") === "2" ? newV2() : null;
        var tl = makeTimeline();
        if (getComputedStyle(r0).perspective === "none") {
          var sz0 = size();
          r0.style.perspective = Math.round(Math.max(sz0.w, sz0.h) * 1.2) + "px";
        }
        try {
          fn(tl, makeS());
        } catch (e) {
          fail(e);
          readyResolve();
          return;
        }
        var r = root();
        if (v2) {
          try { finishV2(tl, r); } catch (e2) { fail(e2); readyResolve(); return; }
        }
        var declared = parseFloat(r.getAttribute("data-duration") || "0");
        r.setAttribute("data-stage-duration", String(Math.round(tl.duration * 1000) / 1000));
        r.setAttribute("data-stage-labels", JSON.stringify(tl.labels));
        if (declared && tl.duration > declared + 0.05) fail(new Error("the timeline runs " + tl.duration.toFixed(2) + " s but the sequence is " + declared + " s long"));
        var a = tl._anime;
        var warm = false;
        window.__miraiclipSeek = function (t) {
          if (!warm) { warm = true; a.seek(a.duration); a.seek(0); }
          a.seek(0);
          a.seek(Math.max(0, t) * 1000);
          if (v2) seekAll(Math.max(0, t), true);
        };
        window.__miraiclipProbe = function (opts) { return probe(tl, r, opts); };
        // How far (px) anything with an id travels between two instants, camera included: what the exporter's
        // motion blur needs to pick a sample count. Seeks, so it leaves the sequence wherever it ended.
        window.__miraiclipMotion = function (from, to) {
          var els = Array.prototype.slice.call(r.querySelectorAll("[id],[data-carry]"), 0, 160);
          function boxes(t) {
            seekPublic(t);
            void document.body.offsetHeight;
            var r0 = r.getBoundingClientRect();
            return els.map(function (el) {
              var rc = el.getBoundingClientRect();
              return { l: rc.left - r0.left, t: rc.top - r0.top, w: rc.width, h: rc.height, on: effectiveOpacity(el, r) > 0.02 && rc.width > 0 && rc.height > 0 };
            });
          }
          var A = boxes(from), B = boxes(to), far = 0;
          for (var i = 0; i < A.length; i++) {
            if (!A[i].on || !B[i].on) continue; // appearing or vanishing is a fade, not motion
            far = Math.max(far,
              Math.hypot(B[i].l - A[i].l, B[i].t - A[i].t),
              Math.hypot(B[i].l + B[i].w - A[i].l - A[i].w, B[i].t + B[i].h - A[i].t - A[i].h));
          }
          return Math.round(far * 100) / 100;
        };
        readyResolve();
      });
    },
  };
})();
