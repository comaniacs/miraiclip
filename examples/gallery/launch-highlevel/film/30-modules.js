// ---- 8.75–50 s: the six modules, one moment of the day each. Every scene: the clock races to its hour, then the
// eyebrow, headline and sub-line on the left and the recreated product UI on the right.
function sceneSpan(i) { return [SCENES[i][1], i < 5 ? SCENES[i + 1][1] : T.recap[0]]; }
function poseScene(i, t) {
  var id = SCENES[i][0], sp = sceneSpan(i), S = sp[0], E = sp[1], el = $("s-" + id), on = t >= S + 0.6 && t < E;
  el.style.display = on ? "block" : "none";
  if (!on) return null;
  el.style.opacity = (1 - smr(t, E - 0.45, E - 0.05)).toFixed(3);
  fadeIO("eb-" + id, S + 1.0, 99, t, 12); lineIO("h-" + id, [S + 1.1, 99], t); fadeIO("sub-" + id, S + 1.45, 99, t, 14);
  return t - S; // local time
}
function typeIn(el, text, t0, t1, t, caret) {
  var n = Math.floor(text.length * c01((t - t0) / (t1 - t0)));
  setHtml(el, n > 0 ? text.slice(0, n) + (caret && t < t1 + 0.25 ? '<span class="caret"></span>' : "") : "");
}
function popIn(el, t0, t, dy) {
  var u = expOut((t - t0) / 0.45);
  el.style.opacity = c01(u * 2).toFixed(3); el.style.transform = "translateY(" + f2((1 - u) * (dy == null ? 24 : dy)) + "px) scale(" + mix(0.96, 1, u).toFixed(4) + ")";
}

// Voice AI: a live call, a transcript, a booking
var VLINES = [["c", "CALLER", "Hi! Do you have anything open tomorrow morning?", 1.6], ["a", "AI EMPLOYEE", "We do. I have 9:30 or 10:30. Which works best?", 2.6],
  ["c", "CALLER", "10:30, please.", 3.8], ["a", "AI EMPLOYEE", "You're booked for 10:30 tomorrow. See you then!", 4.4]];
var VB = VLINES.map(function (l) { var w = mk("who" + (l[0] === "a" ? " a" : ""), $("v-tx"), l[1]), b = mk("bub " + l[0], $("v-tx"), ""); return [w, b]; });
var WAVE = []; for (var i = 0; i < 56; i++) { var bar = document.createElement("i"); $("v-wave").appendChild(bar); WAVE.push(bar); }
function poseVoice(t) {
  var u = poseScene(0, t); if (u == null) return;
  popIn($("v-ui"), 0.9, u, 40);
  var secs = Math.max(0, Math.floor(u - 1.0)); setHtml($("v-timer"), "00:" + (secs < 10 ? "0" : "") + secs);
  var talk = 0.25 + 0.75 * VLINES.reduce(function (m, l) { return Math.max(m, smr(u, l[3] - 0.1, l[3] + 0.1) * (1 - smr(u, l[3] + 0.9, l[3] + 1.1))); }, 0);
  WAVE.forEach(function (b, k) { b.style.height = f2(8 + 64 * talk * Math.abs(Math.sin(u * 9 + k * 0.7) * Math.sin(u * 4.3 + k * 0.29))) + "px"; });
  VLINES.forEach(function (l, k) {
    var v = expOut((u - l[3]) / 0.35);
    VB[k][0].style.opacity = VB[k][1].style.opacity = c01(v * 2).toFixed(3);
    VB[k][1].style.transform = "translateY(" + f2((1 - v) * 16) + "px)";
    if (l[0] === "a") typeIn(VB[k][1], l[2], l[3], l[3] + 0.6, u, false); else setHtml(VB[k][1], l[2]);
  });
  popIn($("v-book"), 5.4, u, 40);
}

// Conversation AI: one inbox, four channels, every thread answered
var CROWS = [["JL", "Jordan Lee", "IG", "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)", "Do you do teeth whitening?"], ["PS", "Priya Shah", "SMS", "#37CA37", "Can I move my cleaning to Friday?"],
  ["MC", "Marco Cruz", "FB", "#1877f2", "Are you open on Saturdays?"], ["AK", "Ava Kim", "Chat", "#7c3aed", "Do you take new patients?"]];
var AVC = ["#ec4899", "#0ea5e9", "#f97316", "#8b5cf6"];
var CR = CROWS.map(function (r, k) {
  var row = mk("row" + (k === 0 ? " on" : ""), $("c-list"), '<div class="avs" style="background:' + AVC[k] + '">' + r[0] + '<u style="background:' + r[3] + '">' + r[2].slice(0, 2) + '</u></div><div class="tx"><b>' + r[1] + "</b><span>" + r[4] + '</span></div><span class="st">AI replied</span>');
  return row;
});
var CIN = mk("bub c", $("c-msgs"), "Hi! Do you do teeth whitening? How does it work?"), CTY = mk("typing", $("c-msgs"), "<i></i><i></i><i></i>"), COUT = mk("bub a", $("c-msgs"), "");
var CREPLY = "Yes, we do! It starts with a free consult so we can plan the right shade. Want me to book you in this week?";
function poseConv(t) {
  var u = poseScene(1, t); if (u == null) return;
  popIn($("c-ui"), 0.9, u, 40);
  popIn(CIN, 1.5, u, 16);
  var ty = u > 2.2 && u < 3.0; CTY.style.opacity = ty ? 1 : 0; CTY.style.display = u < 3.0 ? "flex" : "none";
  [].forEach.call(CTY.children, function (d, k) { d.style.transform = "translateY(" + f2(-5 * Math.max(0, Math.sin(u * 10 - k))) + "px)"; });
  COUT.style.display = u >= 3.0 ? "block" : "none"; COUT.style.opacity = 1;
  typeIn(COUT, CREPLY, 3.0, 4.3, u, false);
  CR.forEach(function (row, k) { var s = row.querySelector(".st"), v = expOut((u - 4.4 - 0.28 * k) / 0.35); s.style.opacity = c01(v * 2).toFixed(3); s.style.transform = "scale(" + mix(0.6, 1, v).toFixed(3) + ")"; });
}

// Reviews AI: a five-star review, a drafted reply, posted
var RREPLY = "Thank you so much, Maria! We're thrilled you felt cared for. See you at your next check-up!";
function poseRev(t) {
  var u = poseScene(2, t); if (u == null) return;
  popIn($("r-card"), 0.9, u, 40);
  [].forEach.call($("r-stars").children, function (s, k) { var v = expOut((u - 1.4 - 0.12 * k) / 0.3); s.className = v > 0.05 ? "on" : ""; s.style.display = "inline-block"; s.style.transform = "scale(" + (v > 0 ? mix(1.6, 1, v) : 1).toFixed(3) + ")"; });
  popIn($("r-reply"), 2.4, u, 40);
  typeIn($("r-rt"), RREPLY, 2.8, 4.6, u, true);
  var click = u >= 5.1, btn = $("r-btn");
  setHtml(btn, click ? "✓ Posted" : "Post reply"); btn.style.background = click ? "#37CA37" : "#188BF6";
  btn.style.transform = "scale(" + (u > 4.95 && u < 5.1 ? 0.92 : 1 + 0.06 * Math.exp(-(u - 5.1) * 6) * (click ? 1 : 0)).toFixed(3) + ")";
}

// Content AI: one prompt, a post with its image, a blog draft
var CTQ = "Write an Instagram post for our summer whitening offer";
var CTCAP = "Summer smiles start here. Book a free whitening consult this month and get camera-ready for every beach day. #SummerSmiles";
function poseContent(t) {
  var u = poseScene(3, t); if (u == null) return;
  popIn($("ct-prompt"), 0.9, u, 30);
  typeIn($("ct-q"), CTQ, 1.1, 2.3, u, true);
  popIn($("ct-post"), 2.5, u, 40);
  var shim = $("ct-img").querySelector(".shim"), r = smoother((u - 3.0) / 0.8);
  shim.style.transform = "translateY(" + f2(-r * 430) + "px)"; shim.style.opacity = (0.75 + 0.25 * Math.sin(u * 8)).toFixed(3);
  $("ct-img").querySelector(".s").style.transform = "translateY(" + f2(mix(30, 0, r)) + "px)";
  typeIn($("ct-cap"), CTCAP, 3.4, 4.9, u, false);
  popIn($("ct-blog"), 3.8, u, 40);
  [].forEach.call($("ct-blog").querySelectorAll(".ln"), function (l, k) { l.style.transform = "scaleX(" + smr(u, 4.0 + 0.12 * k, 4.4 + 0.12 * k).toFixed(3) + ")"; l.style.transformOrigin = "0 50%"; });
}

// Funnel AI: one prompt, three pages, connected
var FQ = "Build a funnel for free whitening consults";
var FP = [
  ["Landing page", '<div class="blk" style="height:150px;background:linear-gradient(135deg,#188BF6,#6cc1ff);padding:18px;color:#fff;font-weight:800;font-size:24px;line-height:1.1">Free whitening<br>consult</div><div class="blk" style="height:12px"></div><div class="blk" style="height:12px;width:80%"></div><div class="blk" style="height:12px;width:90%"></div><div class="blk" style="height:120px;background:#fff3d1"></div><div class="blk" style="height:46px;background:#37CA37;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:18px">Claim my spot</div>'],
  ["Booking", '<div class="blk" style="height:40px;font-weight:800;font-size:22px;background:none">Pick a time</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">' + Array.from({ length: 20 }, function (_, k) { return '<div class="blk" style="height:34px;margin:0;' + (k === 8 ? "background:#188BF6" : "") + '"></div>'; }).join("") + '</div><div class="blk" style="height:12px;margin-top:20px"></div><div class="blk" style="height:46px;background:#188BF6;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:18px">Book consult</div>'],
  ["Thank you", '<div style="height:180px;display:flex;align-items:center;justify-content:center"><div class="ok" style="width:110px;height:110px;border-radius:55px;font-size:56px">✓</div></div><div class="blk" style="height:40px;font-weight:800;font-size:24px;background:none;text-align:center">You\'re booked!</div><div class="blk" style="height:12px"></div><div class="blk" style="height:12px;width:75%;margin-left:12%"></div><div class="blk" style="height:110px;background:#e8f3fe"></div>'],
];
var FPE = FP.map(function (p, k) { var e = mk("ui fp", $("f-pages"), p[1] + '<div class="lab">' + p[0] + "</div>"); e.style.left = (900 + k * 325) + "px"; e.style.overflow = "visible"; return e; });
var FARR = [0, 1].map(function (k) { var x0 = 900 + k * 325 + 270, y = 565; var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", "M" + (x0 + 6) + " " + y + "H" + (x0 + 49)); p.setAttribute("stroke", "#fff"); p.setAttribute("stroke-width", "4"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-dasharray", "60"); $("f-arrows").appendChild(p); return p; });
function poseFunnel(t) {
  var u = poseScene(4, t); if (u == null) return;
  popIn($("f-prompt"), 0.9, u, 30);
  typeIn($("f-q"), FQ, 1.1, 2.2, u, true);
  FPE.forEach(function (e, k) {
    var v = expOut((u - 2.4 - 0.45 * k) / 0.5);
    e.style.opacity = c01(v * 2).toFixed(3); e.style.transform = "translateY(" + f2((1 - v) * 60) + "px) rotate(" + ((1 - v) * (k - 1) * 4).toFixed(2) + "deg)";
    [].forEach.call(e.querySelectorAll(".blk"), function (b, j) { b.style.opacity = smr(u, 2.6 + 0.45 * k + 0.05 * j, 2.9 + 0.45 * k + 0.05 * j).toFixed(3); });
  });
  FARR.forEach(function (p, k) { p.setAttribute("stroke-dashoffset", (60 * (1 - smr(u, 3.4 + 0.45 * k, 3.8 + 0.45 * k))).toFixed(1)); });
  $("f-arrows").style.opacity = 1;
}

// Workflow AI Assistant: describe the follow-up, apply the suggested steps
var WQ = "Follow up with new leads until they book a consult.";
var WN = [["TRIGGER", "Form submitted", "#188BF6", 475, 40], ["ACTION", "Send SMS: Thanks for reaching out!", "#37CA37", 475, 170], ["WAIT", "Wait 1 day", "#9ca3af", 475, 300],
  ["CONDITION", "Appointment booked?", "#FFBC00", 475, 430], ["YES", "Add tag: booked", "#37CA37", 350, 600], ["NO", "Send reminder email", "#188BF6", 660, 600]];
var WE = WN.map(function (n) { var e = mk("node", $("w-nodes"), "<small>" + n[0] + "</small>" + n[1]); e.style.setProperty("--c", n[2]); e.style.left = n[3] + "px"; e.style.top = n[4] + "px"; if (n[3] !== 475) e.style.width = "270px"; return e; });
var WL = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]].map(function (pr) {
  var a = WN[pr[0]], b = WN[pr[1]], ax = a[3] + 165, ay = a[4] + 76, bx = b[3] + (b[3] === 475 ? 165 : 135), by = b[4];
  var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", "M" + ax + " " + ay + "C" + ax + " " + (ay + 40) + " " + bx + " " + (by - 40) + " " + bx + " " + by);
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "#9aa3b5"); p.setAttribute("stroke-width", "3"); p.setAttribute("stroke-dasharray", "400"); $("w-lines").appendChild(p); return p;
});
function poseFlow(t) {
  var u = poseScene(5, t); if (u == null) return;
  popIn($("w-ui"), 0.9, u, 40);
  popIn($("w-ai"), 1.2, u, 20);
  typeIn($("w-q"), WQ, 1.4, 2.6, u, true);
  $("w-sug").style.opacity = smr(u, 2.75, 3.0).toFixed(3);
  var btn = $("w-btn"); btn.style.opacity = smr(u, 2.9, 3.1).toFixed(3); btn.style.transform = "scale(" + (u > 3.25 && u < 3.4 ? 0.92 : 1) + ")";
  WE.forEach(function (e, k) { popIn(e, 3.45 + 0.32 * k, u, 20); });
  WL.forEach(function (p, k) { p.setAttribute("stroke-dashoffset", (400 * (1 - smr(u, 3.6 + 0.32 * k, 3.95 + 0.32 * k))).toFixed(1)); });
}
