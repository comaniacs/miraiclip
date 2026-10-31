// ---- the scenes. Every pose is a pure function of t; pictures load only while on screen.
function show(id, on) { $(id).style.display = on ? "block" : "none"; }
function pic(img, on) { var want = on ? IMG[img.dataset.img] : ""; if (img.dataset.on !== String(!!on)) { if (on) img.src = want; else img.removeAttribute("src"); img.dataset.on = String(!!on); } }
function hexPts(cx, cy, r) {
  var p = []; for (var k = 0; k < 6; k++) { var a = (-90 + 60 * k) * deg; p.push(f2(cx + r * Math.cos(a)) + "px " + f2(cy + r * Math.sin(a)) + "px"); }
  return p;
}
// a hexagonal window onto el, centred at (cx, cy); big enough and it simply goes away
function hexClip(el, cx, cy, r) { el.style.clipPath = r > 1300 ? "none" : "polygon(" + hexPts(cx, cy, Math.max(0, r)).join(",") + ")"; }
function hexLine(svg, cx, cy, r, a) { var p = svg.firstElementChild; p.setAttribute("points", hexPts(cx, cy, Math.max(0, r)).join(" ").replace(/px/g, "")); svg.style.opacity = a.toFixed(3); }
function setBox(el, x, y, w, h) { el.style.left = f2(x) + "px"; el.style.top = f2(y) + "px"; el.style.width = f2(w) + "px"; el.style.height = f2(h) + "px"; }
function lerpBox(a, b, u) { return a.map(function (v, i) { return mix(v, b[i], u); }); }

var PAPER = "#f2efe8", INK = "#0d0d0d", YEL = "#ffd400";

// 1 · the hook: "Your users want to edit video." One word per beat, full frame.
var WORDS = [["Your", YEL, INK], ["users", INK, PAPER], ["want to", PAPER, INK], ["edit", YEL, INK], ["video.", INK, YEL]];
var hook = $("hook"), wordEl = mk("word", hook), hmeta = mk("meta", hook, "Miraiclip — launch"), hcount = mk("meta", hook), hfoot = mk("meta", hook, "miraiclip.com");
hmeta.id = "hmeta"; hcount.id = "hcount"; hfoot.id = "hfoot";
function poseHook(t) {
  show("hook", t < T.ap[0]);
  if (t >= T.ap[0]) return;
  var k = clamp(Math.floor(t / BEAT + 1e-6), 0, 4), w = WORDS[k], local = t - T.words[k], kick = Math.exp(-local * 14);
  hook.style.background = w[1]; hook.style.color = w[2];
  setHtml(wordEl, w[0]);
  wordEl.style.transform = "scale(" + (1 + 0.2 * kick).toFixed(4) + ") skewX(" + (-10 * kick).toFixed(2) + "deg)";
  setHtml(hcount, "0" + (k + 1) + " / 05");
}

// 2 · the aperture: the mark's hexagon opens on the editor, then frames it as a card.
var apcard = $("apcard"), apclip = $("apclip");
var AP_ZOOM = [960 - 900 * 1.875, 540 - 330 * 1.875, 3000, 1687.5], AP_CARD = [240, 230, 1440, 810], CAR = [410, 290, 1100, 618.75];
function poseAperture(t) {
  var on = t >= T.ap[0] && t < T.themes[0];
  show("ap", on); pic(apcard.firstChild, on);
  if (!on) return;
  var r = 230 * expOut((t - T.ap[0]) / 0.5) + 1500 * smoother((t - 3.9) / 0.9);
  hexClip(apclip, 960, 540, r);
  hexLine($("hexline"), 960, 540, r + 16, 1 - smr(t, 3.9, 4.3));
  var box = lerpBox(lerpBox(AP_ZOOM, AP_CARD, smoother((t - 3.4) / 1.6)), CAR, smoother((t - 6.6) / 0.6));
  setBox(apcard, box[0], box[1], box[2], box[3]);
  apcard.style.borderRadius = mix(0, 18, smr(t, 3.6, 4.6)).toFixed(1) + "px";
  lineIO("aph", T.apHead, t);
}

// 3 · one engine, every look: five real editor themes, one per two beats, each on a hexagon wipe of its colour.
var THEMES = [["ed0", "#0f2a23", PAPER], ["ed1", "#17165a", PAPER], ["ed2", "#0a0a0a", PAPER], ["ed3", YEL, INK], ["ed4", PAPER, INK]];
var CARDS = THEMES.map(function (th) { var c = mk("", $("tcards"), '<img data-img="' + th[0] + '">'); return c; });
function slot(t) { return clamp(Math.floor((t - T.themes[0]) / (2 * BEAT) + 1e-6), 0, 4); }
function poseThemes(t) {
  var on = t >= T.themes[0] && t < T.tour[0] + 0.5;
  show("tscene", on);
  if (!on) { CARDS.forEach(function (c) { pic(c.firstChild, false); }); return; }
  var k = slot(t), s = T.themes[0] + 2 * BEAT * k;
  $("tbase").style.background = k ? THEMES[k - 1][1] : INK;
  $("twipe").style.background = THEMES[k][1];
  hexClip($("twipe"), 960, 600, 1400 * expOut((t - s) / 0.5));
  var f = 0; for (var j = 1; j < 5; j++) f += expOut((t - T.themes[0] - 2 * BEAT * j) / 0.55);
  CARDS.forEach(function (c, i) {
    var d = i - f, vis = Math.abs(d) < 1.8;
    c.style.display = vis ? "block" : "none"; pic(c.firstChild, vis);
    setBox(c, CAR[0], CAR[1], CAR[2], CAR[3]);
    c.style.transform = "translate3d(" + f2(d * 1150) + "px,0," + f2(-Math.abs(d) * 420) + "px) rotateY(" + (-d * 28).toFixed(2) + "deg)";
  });
  var ink = t - s > 0.12 ? THEMES[k][2] : k ? THEMES[k - 1][2] : PAPER;
  $("th1").style.color = $("th2").style.color = $("tcount").style.color = ink;
  lineIO("th1", [T.themes[0] + 0.2, T.tour[0] - 0.3], t); lineIO("th2", [T.themes[0] + 2 * BEAT, T.tour[0] - 0.3], t);
  setHtml($("tcount"), "0" + (k + 1) + " / 05 themes");
}

// 4 · the tour: you bring the UI, we bring the rest. A camera over the real editor, a chip per stop.
var TV = [[13.2, 800, 450, 1.0], [14.3, 800, 450, 1.05], [14.9, 830, 330, 1.9], [15.8, 840, 335, 1.97], [16.3, 900, 770, 1.8], [17.0, 905, 770, 1.86],
  [17.5, 1420, 370, 2.0], [18.2, 1420, 370, 2.06], [18.7, 1420, 60, 2.7], [19.2, 1420, 60, 2.8]];
var TVX = curve(TV.map(function (k) { return [k[0], k[1]]; })), TVY = curve(TV.map(function (k) { return [k[0], k[2]]; })), TVZ = curve(TV.map(function (k) { return [k[0], Math.log(k[3])]; }));
var CHIPS = ["Frame-accurate preview", "Multi-track timeline", "AI assistant · every step undoable", "Export MP4 &amp; WebM"];
function poseTour(t) {
  var on = t >= T.tour[0] && t < T.proof[0] + 0.5, img = $("tour").querySelector("img");
  show("tour", on); pic(img, on);
  if (!on) return;
  hexClip($("tour"), 960, 560, 1400 * expOut((t - T.tour[0]) / 0.5));
  var s = 1.2 * Math.exp(TVZ(t)), fx = TVX(t), fy = TVY(t);
  var ox = clamp(960 - fx * s, W - 1600 * s, 0), oy = clamp(540 - fy * s, H - 900 * s, 0);
  img.style.transform = "translate(" + f2(ox) + "px," + f2(oy) + "px) scale(" + s.toFixed(4) + ")";
  $("scrim").style.opacity = (1 - smr(t, 14.1, 14.5)).toFixed(3);
  lineIO("tu1", [13.45, 14.15], t); lineIO("tu2", [13.75, 14.15], t);
  fadeIO("band", T.stops[0] + 0.1, T.proof[0] - 0.2, t, 16);
  var k = -1; T.stops.forEach(function (st, i) { if (t >= st + 0.3) k = i; });
  var chip = $("chip"), pop = k < 0 ? 0 : expOut((t - T.stops[k] - 0.3) / 0.35);
  chip.style.opacity = (k < 0 ? 0 : c01(pop * 2) * (1 - smr(t, T.proof[0] - 0.3, T.proof[0]))).toFixed(3);
  chip.style.transform = "scale(" + mix(0.8, 1, pop).toFixed(4) + ")"; chip.style.transformOrigin = "0 100%";
  if (k >= 0) { setHtml($("chipk"), "0" + (k + 1) + " — built in"); setHtml($("chipt"), CHIPS[k]); }
  var ring = k < 0 ? 0 : expOut((t - T.stops[k] - 0.35) / 0.7);
  hexLine($("ring"), ox + fx * s, oy + fy * s, mix(30, 260, ring), k < 0 ? 0 : (1 - ring) * 0.9);
}

// 5 · proof: three sections of miraiclip.com in browser windows, each pushing the last back.
var PAGES = [["w0", 0], ["w1", 306], ["w2", 414]];
function poseProof(t) {
  var on = t >= T.proof[0] && t < T.end[0] + 0.9;
  show("proof", on);
  PAGES.forEach(function (p) { pic($(p[0]).querySelector("img"), on); });
  if (!on) return;
  hexClip($("proof"), 960, 560, 1400 * expOut((t - T.proof[0]) / 0.5));
  lineIO("pcap", [T.proof[0] + 0.3, T.end[0] - 0.2], t);
  PAGES.forEach(function (p, j) {
    var el = $(p[0]), P = T.pages[j], next = j < 2 ? T.pages[j + 1] : T.end[0];
    var e = expOut((t - P) / 0.7), l = smoother((t - next) / 0.7), gone = j < 1 ? smr(t, T.pages[2], T.pages[2] + 0.5) : 0;
    el.style.display = t >= P ? "block" : "none";
    el.style.left = "260px"; el.style.top = "250px";
    el.style.transform = "translate3d(" + f2(mix(1500, 0, e) - 560 * l) + "px," + f2(-50 * l) + "px," + f2(-700 * l) + "px) rotateY(" + (mix(-30, 0, e) + 22 * l).toFixed(2) + "deg)";
    el.style.opacity = (c01(e * 3) * (1 - 0.5 * l) * (1 - gone) * (1 - smr(t, T.end[0] + 0.3, T.end[0] + 0.8))).toFixed(3);
    el.querySelector("img").style.transform = "translateY(" + f2(-p[1] * smr(t, P + 0.7, P + 2.1)) + "px)";
  });
}

// 6 · the end: the homepage rises, the aperture closes into the mark, yellow floods out of it.
var MC = [960, 240];
function poseEnd(t) {
  var on = t >= T.end[0];
  show("end", on); pic($("ewin").querySelector("img"), on && t < T.wipe);
  if (!on) return;
  $("end").style.background = t < T.end[0] + 0.9 ? "transparent" : PAPER; // paper again once the proof scene behind it hides
  var ewin = $("ewin"), e = expOut((t - T.end[0]) / 0.8), cl = smoother((t - T.close[0]) / (T.close[1] - T.close[0]));
  ewin.style.display = t < T.wipe ? "block" : "none";
  ewin.style.transform = "translateY(" + f2(mix(900, 0, e)) + "px)";
  hexClip(ewin, MC[0] - 269, MC[1] - 170, cl > 0 ? mix(1300, 72, cl) : 2000);
  hexClip($("eyel"), MC[0], MC[1], 1500 * expOut((t - T.wipe) / 0.6));
  $("eyel").style.display = t >= T.wipe ? "block" : "none";
  var m = expOut((t - T.wipe) / 0.6);
  $("mark").style.opacity = t >= T.wipe ? 1 : 0;
  $("mark").style.transform = "scale(" + mix(1.35, 1, m).toFixed(4) + ") rotate(" + mix(-60, 0, m).toFixed(2) + "deg)";
  var n = smoother((t - T.name) / 0.7);
  $("ename").style.opacity = n.toFixed(3); $("ename").style.letterSpacing = mix(0.04, -0.065, n).toFixed(4) + "em";
  fadeIO("etag", T.tag, 99, t, 20);
  var c = c01((t - T.url) / 0.45), back = 1 + 2.4 * Math.pow(c - 1, 3) + 1.4 * Math.pow(c - 1, 2);
  $("eurl").style.opacity = c01(c * 3).toFixed(3); $("eurl").style.transform = "scale(" + (c > 0 ? back : 0.5).toFixed(4) + ")";
  fadeIO("eoss", T.url + 0.3, 99, t, 12);
}
