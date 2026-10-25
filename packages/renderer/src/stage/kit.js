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
      get duration() { return end; },
      get labels() { return labels; },
      _anime: tl,
    };
    return api;
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
      /** The time of beat n (seconds), or n × 0.5 s without a beat grid. */
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

  var built = false;
  window.stage = {
    build: function (fn) {
      if (built) { fail(new Error("stage.build() can only be called once")); return; }
      built = true;
      var whenLoaded = document.readyState === "complete" ? Promise.resolve() : new Promise(function (r) { window.addEventListener("load", r); });
      whenLoaded.then(loadFonts).then(function () {
        var tl = makeTimeline();
        var r0 = root();
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
        };
        readyResolve();
      });
    },
  };
})();
