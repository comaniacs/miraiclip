// ---- the 2D layer: the hook words, the cards (code, monitor, assistant, export), the end card, the HUD and the light.

// The hook: three words slam in as coloured blocks, grow trim handles, then shrink into the timeline's first clips.
var HOOK = [];
[0, 1, 2].forEach(function (k) {
  var c = CLIPS[k], el = mk("hw " + c.col, $("hook"), '<i class="l"></i>' + c.label + '<i class="r"></i>');
  HOOK.push({ el: el, w: el.offsetWidth, top: 170 + k * 262, clip: c });
});
function poseHook(t) {
  $("hook").style.display = t < T.morph[1] ? "block" : "none";
  var flash = 0;
  HOOK.forEach(function (h, k) {
    var s = T.slams[k], u = expOut((t - s + 0.14) / 0.3), since = t - s;
    var shake = since > 0 ? 16 * Math.exp(-since * 9) : 0;
    if (since > 0) flash = Math.max(flash, 0.3 * Math.exp(-since * 14));
    var m = smoother((t - T.morph[0] - 0.1 * k) / 0.8), c = h.clip;
    var x = mix((W - h.w) / 2, W / 2 + c.x, m), y = mix(h.top, H / 2 + laneY(c.tr) + 6, m);
    var w = mix(h.w, c.w, m), hh = mix(190, 52, m);
    h.el.style.left = f2(x) + "px"; h.el.style.top = f2(y) + "px"; h.el.style.width = f2(w) + "px"; h.el.style.height = f2(hh) + "px";
    h.el.style.fontSize = mix(150, 17, m).toFixed(2) + "px";
    h.el.style.letterSpacing = mix(-0.04, -0.01, m).toFixed(4) + "em";
    h.el.style.borderRadius = mix(28, 9, m).toFixed(1) + "px";
    h.el.style.padding = "0";
    h.el.style.opacity = c01(u * 4).toFixed(3);
    h.el.style.transform = "translate(" + f2(Math.sin(t * 87 + k) * shake) + "px," + f2(Math.cos(t * 71 + k) * shake) + "px) scale(" + mix(2.3, 1, u).toFixed(4) + ") rotate(" + (mix(k % 2 ? 7 : -7, 0, u)).toFixed(2) + "deg)";
    var hd = smr(t, 1.4 + 0.1 * k, 1.8 + 0.1 * k) * (1 - m);
    h.el.querySelectorAll("i").forEach(function (i) { i.style.opacity = hd.toFixed(3); });
  });
  // a white playhead plays the three words, then hands over to the timeline's
  var p = c01((t - 1.35) / 1.0);
  $("hph").style.opacity = (smr(t, 1.3, 1.45) * (1 - smr(t, 2.25, 2.45))).toFixed(3);
  $("hph").style.transform = "translateX(" + f2(mix(260, 1660, sm(p))) + "px)";
  return flash;
}

// Typed code with syntax colours: tokens truncated to n characters.
function tokens(line) {
  var out = [], re = /("[^"]*")|(project)|(\.dispatch|\.undo|\.redo)|([^"]+?(?=project|"|\.dispatch|\.undo|\.redo|$))/g, m;
  while ((m = re.exec(line)) && m[0]) out.push({ cls: m[1] ? "s" : m[2] ? "p" : m[3] ? "k" : "", text: m[0] });
  return out;
}
var CODE_TOK = T.code.map(tokens);
function typed(toks, n) {
  var html = "";
  toks.forEach(function (tk) { if (n <= 0) return; var s = tk.text.slice(0, n); n -= tk.text.length; html += tk.cls ? '<span class="' + tk.cls + '">' + s + "</span>" : s; });
  return html;
}
var OK = ["✓ applied", "✓ applied", "✓ applied", "↶ undone", "↷ redone"];
function poseCode(t) {
  fadeIO("code", T.cmd[0] + 0.1, T.cmd[1] - 0.35, t, 30);
  var html = "", typing = -1;
  T.code.forEach(function (line, k) {
    var n = Math.floor((t - T.lines[k]) * CPS);
    if (n <= 0) { html += "\n"; return; }
    if (n < line.length) typing = k;
    html += typed(CODE_TOK[k], n) + (k === typing ? '<span class="caret"></span>' : "");
    if (t >= T.cmdAt[k]) html += '<span class="ok' + (k >= 3 ? " u" : "") + '">' + OK[k] + "</span>";
    html += "\n";
  });
  setHtml($("pre"), html.replace(/\n$/, ""));
}

// 79 effects: a counter, and a monitor whose picture runs through real effect names from the catalog.
var LOOKS = [
  ["Original", "", "", "normal", 0],
  ["Teal & Orange", "saturate(1.35) contrast(1.1)", "linear-gradient(180deg,#0f6d7a,#ff8a3d)", "soft-light", 0.9],
  ["Noir", "grayscale(1) contrast(1.6) brightness(0.95)", "", "normal", 0],
  ["Golden Hour", "sepia(0.35) saturate(1.6) brightness(1.08)", "radial-gradient(circle at 60% 40%,#ffd27a,transparent 70%)", "screen", 0.55],
  ["Cyberpunk", "hue-rotate(205deg) saturate(1.9) contrast(1.2)", "linear-gradient(135deg,#ff2bd6,#00e5ff)", "overlay", 0.6],
  ["Thermal", "invert(1) hue-rotate(180deg) saturate(3) contrast(1.2)", "", "normal", 0],
  ["Vaporwave", "hue-rotate(250deg) saturate(1.5)", "linear-gradient(180deg,#ff7ad9,#7af2ff)", "soft-light", 0.8],
  ["Scanlines", "contrast(1.25) saturate(1.2)", "repeating-linear-gradient(180deg,rgba(0,0,0,0.55) 0 2px,transparent 2px 5px)", "normal", 1],
  ["Halftone", "grayscale(0.4) contrast(1.4)", "radial-gradient(circle,rgba(0,0,0,0.7) 32%,transparent 36%) 0 0/9px 9px", "multiply", 1],
  ["RGB Split", "drop-shadow(7px 0 0 rgba(255,0,60,0.7)) drop-shadow(-7px 0 0 rgba(0,240,255,0.7))", "", "normal", 0],
  ["Infrared", "hue-rotate(140deg) saturate(2.4) brightness(1.1)", "", "normal", 0],
  ["Duotone", "grayscale(1) contrast(1.35)", "linear-gradient(135deg,#2dd4bf,#8b7bff 55%,#ff6b4a)", "color", 1],
];
var LOOK_T0 = T.fx[0] + 0.6, LOOK_DT = 0.36;
function poseFx(t) {
  var end = T.fx[1] - 0.4;
  fadeIO("fxn", T.fx[0] + 0.1, end, t, 40); fadeIO("fxl", T.fx[0] + 0.35, end, t, 20); fadeIO("fxc", T.fx[0] + 0.7, end, t, 20);
  var n = Math.round(79 * smoother((t - T.fx[0] - 0.25) / 3.6)), pop = Math.exp(-Math.max(0, t - T.fx[0] - 3.85) * 6) * (t > T.fx[0] + 3.85 ? 1 : 0);
  setHtml($("fxn"), String(n));
  $("fxn").style.transform += " scale(" + (1 + 0.08 * pop).toFixed(4) + ")";
  fadeIO("mon", T.fx[0] + 0.2, end, t, 40); fadeIO("mlab", T.fx[0] + 0.5, end, t, 16);
  var i = clamp(Math.floor((t - LOOK_T0) / LOOK_DT), 0, LOOKS.length - 1), L = LOOKS[i];
  $("scr").style.filter = L[1];
  $("look").style.background = L[2] || "none"; $("look").style.mixBlendMode = L[3]; $("look").style.opacity = L[4];
  setHtml($("mname"), L[0]);
  // the sun climbs and the ridges drift, so the picture lives
  var u = c01((t - T.fx[0]) / 5.5);
  $("sun").style.transform = "translateY(" + f2(mix(70, -30, u)) + "px)";
  $("m1").style.transform = "translate(" + f2(mix(0, -40, u)) + "px,40px)";
  $("m2").style.transform = "translate(" + f2(mix(0, -80, u)) + "px,130px) scaleX(-1.3)";
}

// The assistant: a prompt is typed, then three tool calls run as commands.
var PROMPT = "Make the intro punchier.";
var CALLS = [["clip/trim", "intro.mp4, product.mov"], ["clip/move", "ripple left · 3 clips"], ["transition/add", "intro → product"]];
CALLS.forEach(function (c) { mk("", $("calls"), "<i>⌘</i>" + c[0] + ' <span style="color:rgba(238,243,242,0.45)">' + c[1] + "</span><em>✓</em>"); });
function poseAi(t) {
  fadeIO("prompt", T.ai[0] + 0.1, T.ai[1] - 0.4, t, 30);
  var n = Math.floor(PROMPT.length * c01((t - T.type[0]) / (T.type[1] - T.type[0])));
  setHtml($("pin"), n > 0 ? PROMPT.slice(0, n) + (t < T.type[1] + 0.2 ? '<span class="caret"></span>' : "") : '<span class="ph">Ask for any edit…</span>');
  [].forEach.call($("calls").children, function (el, k) {
    var u = expOut((t - T.calls[k]) / 0.4);
    el.style.opacity = c01(u * 1.5).toFixed(3); el.style.transform = "translateX(" + f2((1 - u) * 40) + "px)";
  });
}

// Export: the bar fills as the timeline's playhead runs the whole cut.
function exportU(t) { return c01((t - 24.3) / 1.8); }
function poseExport(t) {
  fadeIO("exp", T.exp[0] + 0.2, T.flash - 0.15, t, 30);
  var u = exportU(t);
  $("pbar").firstChild.style.width = (u * 100).toFixed(2) + "%";
  setHtml($("pct"), u >= 1 ? "✓ Done" : Math.floor(u * 100) + "%");
  [].forEach.call($("fmts").children, function (el, k) {
    var v = expOut((t - T.exp[0] - 0.5 - 0.12 * k) / 0.35);
    el.style.opacity = c01(v * 1.5).toFixed(3); el.style.transform = "scale(" + mix(0.6, 1, v).toFixed(3) + ")";
  });
}

// The end card: the mark spins in, the name tightens, the URL pops.
function poseEnd(t) {
  $("end").style.opacity = smr(t, T.flash - 0.05, T.flash + 0.2).toFixed(3);
  var a = expOut((t - T.logo) / 0.8);
  $("logo").style.transform = "scale(" + mix(0.2, 1, a).toFixed(4) + ") rotate(" + mix(-150, 0, a).toFixed(2) + "deg)";
  $("logo").style.opacity = c01(a * 2).toFixed(3);
  var b = smoother((t - T.title) / 0.8);
  $("name").style.opacity = b.toFixed(3); $("name").style.letterSpacing = mix(0.12, -0.045, b).toFixed(4) + "em";
  $("name").style.transform = "translateY(" + f2((1 - b) * 30) + "px)";
  fadeIO("etag", T.tag, 99, t, 20);
  var c = c01((t - T.url) / 0.45), back = 1 + 2.4 * Math.pow(c - 1, 3) + 1.4 * Math.pow(c - 1, 2);
  $("url").style.opacity = c01(c * 3).toFixed(3); $("url").style.transform = "scale(" + (c > 0 ? back : 0.5).toFixed(4) + ")";
  fadeIO("oss", T.url + 0.4, 99, t, 12);
  $("glow").style.opacity = smr(t, T.flash, T.flash + 1).toFixed(3);
}

// The HUD: corner marks, the spec line and a running timecode, gone before the end card.
function poseHud(t) {
  $("hud").style.opacity = (1 - smr(t, T.flash - 0.3, T.flash)).toFixed(3);
  var fr = Math.floor(t * T.FPS + 1e-6), pad = function (x) { return (x < 10 ? "0" : "") + x; };
  setHtml($("tc"), "00:00:" + pad(Math.floor(fr / T.FPS)) + ":" + pad(fr % T.FPS));
}

// Three soft orbs of light drift behind everything and gather behind the mark at the end.
var ORBS = [["o1", "#14b8a6", 760, -200, 120, 1300, 300], ["o2", "#7c6cff", 680, 1300, 600, 300, 700], ["o3", "#ff5a3c", 520, 900, -120, 1500, 900]];
function poseBg(t) {
  var tt = Math.min(t, T.rest[0]), g = smr(tt, T.flash - 0.4, T.flash + 1.4);
  ORBS.forEach(function (o, k) {
    var e = $(o[0]), x = o[3] + 220 * Math.sin(tt * 0.31 + k * 2), y = o[4] + 160 * Math.cos(tt * 0.27 + k);
    x = mix(x, 960 - o[2] / 2 + (k - 1) * 260, g); y = mix(y, 330 - o[2] / 2 + (k === 1 ? 160 : 0), g);
    e.style.width = e.style.height = o[2] + "px"; e.style.background = o[1];
    e.style.transform = "translate(" + f2(x) + "px," + f2(y) + "px)";
    e.style.opacity = (k === 2 ? 0.16 : 0.24).toFixed(3);
  });
}
