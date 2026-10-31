// ---- the 3D layer around the real window: idea cards that thread into the calendar, day tiles, the cards that
// carry content from one screen to the next, the plan lifted off the month, and the hero panels. Where something
// stands for app content it is built from the app itself: the seed posts, layout rects read from the live DOM,
// and snapshots of real panels taken by the replay. place / flyClone / heroClone come from the kit.
var esc = KitelineViews.esc;
var SEED = KitelineCore.seedPosts(T.TODAY);
var post = function (id) { return SEED.filter(function (p) { return p.id === id; })[0]; };
function wmk(cls, html) { return mk(cls, world, html); }

// ---- 1 · the ideas: five are the real posts on the calendar (they'll land on their chips), six are loose notes
var REAL = ["p5", "p6", "p7", "p9", "p10"];
var LOOSE = ["Reel idea: a day of meetings in 15 seconds?", "Q4 recap: carousel or thread?", "Ask design for launch visuals", "Customer quote from Lena's team", "Poll: worst meeting habit?", "Repost the webinar clip?"];
var SCATTER = [
  [-560, -250, 160, -8], [380, -330, -120, 6], [-140, 130, 320, -4], [720, 120, 60, 9], [140, -40, -420, -6],
  [-1040, -380, -260, 7], [980, -300, -380, -9], [-760, 380, -60, 5], [520, 430, -200, -7], [-300, -520, -500, 8], [1180, 300, -640, -5],
];
var ideas = REAL.map(function (id, i) {
  var p = post(id), e = wmk("idea real");
  e.innerHTML = '<div class="ih"><i class="kl-pf p-' + p.platform + '">' + KitelineCore.PLATFORMS[p.platform].tag + "</i><span>" + KitelineCore.PLATFORMS[p.platform].name + "</span></div><p>" + esc(KitelineCore.titleOf(p.text)) + "</p>";
  return { el: e, id: id, s: SCATTER[i], k: i };
}).concat(LOOSE.map(function (txt, j) {
  return { el: wmk("idea loose", '<div class="ih"><span>Idea</span></div><p>' + esc(txt) + "</p>"), s: SCATTER[5 + j], k: 5 + j };
}));
var IDEA_W = 330, IDEA_H = 124;
function ideaDrift(it, t) { return [it.s[0] + 26 * Math.sin(0.5 * t + it.k), it.s[1] + 18 * Math.cos(0.43 * t + it.k * 1.7), it.s[2] + 40 * t]; }
// where each real idea ends: its chip in the month view, read from the live app
function poseIdeas(t) {
  var pts = [];
  if (t > T.appIn[1]) { ideas.forEach(function (it) { it.el.style.display = "none"; }); return pts; } // the hook is over
  ideas.forEach(function (it, i) {
    var d = ideaDrift(it, t), e = it.el;
    if (!it.id) { // loose notes drift back and away once the line passes them by
      var u = smoother((t - 1.9 - 0.08 * (i - 5)) / 1.3);
      e.style.opacity = (Math.min(1, t / 0.4 + 0.6) * (1 - u)).toFixed(3);
      if (u >= 1) { e.style.display = "none"; return; }
      e.style.display = "block";
      place(e, d[0] + WIN_W / 2 - IDEA_W / 2, d[1] + WIN_H / 2 - IDEA_H / 2, d[2] - 900 * u * u, IDEA_W, IDEA_H, " rotateY(" + it.s[3] + "deg)");
      return;
    }
    var chip = host.querySelector('.kl-chip[data-post="' + it.id + '"]'), r = chip ? layoutRect(chip) : { x: 0, y: 0, w: 140, h: 22 };
    var v = smoother((t - T.land[0] - 0.09 * i) / (T.land[1] - T.land[0] - 0.36));
    e.style.display = "block";
    var cx = mix(d[0] + WIN_W / 2, r.x + r.w / 2, v), cy = mix(d[1] + WIN_H / 2, r.y + r.h / 2, v), z = mix(d[2], 0, v) + 120 * Math.sin(Math.PI * v);
    var w = mix(IDEA_W, r.w, v), h = mix(IDEA_H, r.h, v);
    place(e, cx - w / 2, cy - h / 2, z, w, h, " rotateY(" + mix(it.s[3], 0, v).toFixed(2) + "deg)");
    e.style.setProperty("--m", v.toFixed(3)); // the card's content gives way to a chip as it lands
    e.style.opacity = (1 - smr(t, T.appIn[0] + 0.25, T.appIn[1])).toFixed(3);
    pts.push(w2w(cx, cy, z));
  });
  return pts;
}

// ---- the day tiles: one per real calendar cell, assembling on the diagonal
var tileEls = [];
for (var i = 0; i < 42; i++) tileEls.push(wmk("tile"));
function poseTiles(t) {
  if (t > T.appIn[1]) { tileEls.forEach(function (e) { e.style.display = "none"; }); return; }
  var cells = host.querySelectorAll(".kl-cell");
  tileEls.forEach(function (e, i) {
    var r = layoutRect(cells[i]), d = (i % 7 + Math.floor(i / 7)) * 0.07, u = smoother((t - T.tiles[0] - d) / 0.6);
    var out = smr(t, T.appIn[0], T.appIn[1]);
    e.style.display = u <= 0 || out >= 1 ? "none" : "block";
    place(e, r.x + 3, r.y + 3, -260 * (1 - u), r.w - 6, r.h - 6);
    e.style.opacity = (u * (1 - out)).toFixed(3);
  });
}

// ---- the carry cards between screens
var liftCard = wmk("carry thu", "<small>Thu</small><b>12</b><span>Launch day</span>");
var promptFly = wmk("kl-app clone fly"), previewFly = wmk("kl-app clone fly");
function rectOf(sel) { var e = host.querySelector(sel); return e ? layoutRect(e) : null; }
function poseCarry(t, rec) {
  // the Thursday column lifts out of the week and becomes the idea field
  var a = rec.caps.thu, u1 = smoother((t - T.lift[0]) / 0.45), u2 = smoother((t - T.lift[0] - 0.3) / (T.lift[1] - T.lift[0] - 0.35));
  if (a && t < T.lift[1]) {
    var to = rectOf('[data-field="idea"]');
    place(liftCard, mix(a.rect.x, to.x, u2), mix(a.rect.y, to.y, u2), 150 * u1 * (1 - u2) + 40 * arc(u2), mix(a.rect.w, to.w, u2), mix(Math.min(a.rect.h, 160), to.h, u2));
    liftCard.style.display = "flex"; liftCard.style.opacity = (1 - smr(t, T.lift[1] - 0.22, T.lift[1])).toFixed(3);
  } else liftCard.style.display = "none";
  flyClone(promptFly, rec.caps.prompt, rectOf('[data-field="text"]'), T.promptFly, t, 0.55);
  flyClone(previewFly, rec.caps.preview, rectOf('.kl-col[data-date="2026-11-12"] .kl-card'), T.previewFly, t, 1);
}

// ---- 5 · the plan: every chip of the month lifts off its date; the line ties the scheduled ones in order
var liftLayer = wmk("g3");
function liftAmt(t) { return smoother((t - T.chipsUp[0]) / (T.chipsUp[1] - T.chipsUp[0])) * (1 - smoother((t - T.settle[0]) / (T.settle[1] - T.settle[0]))); }
function poseLifts(t) {
  var L = liftAmt(t), pts = [];
  liftLayer.replaceChildren();
  if (L <= 0 || host.querySelector(".kl-month") === null) return pts;
  Array.prototype.slice.call(host.querySelectorAll(".kl-cell:not(.out) .kl-chip")).forEach(function (c, i) {
    var r = layoutRect(c), z = L * (46 + 30 * ((i * 7) % 3)), launch = c.dataset.post === "p100";
    var sh = mk("lshadow", liftLayer); place(sh, r.x + z * 0.12, r.y + z * 0.25, 0.5, r.w, r.h); sh.style.opacity = (0.5 * L).toFixed(3);
    place(mk("kl-app clone lchip" + (launch ? " launch" : ""), liftLayer, c.outerHTML), r.x, r.y, z, r.w, r.h);
    c.style.visibility = "hidden";
    if (c.classList.contains("s-scheduled")) pts.push({ date: c.closest(".kl-cell").dataset.date, p: w2w(r.x + r.w / 2, r.y + r.h / 2, z + 2) });
  });
  return pts.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).map(function (p) { return p.p; });
}

// ---- 6 · hero panels: the real prompt and the real preview, floating in front of the window
var heroPrompt = wmk("kl-app clone hero"), heroPreview = wmk("kl-app clone hero");
function poseHero(t, rec) {
  heroClone(heroPrompt, rec.caps.prompt, { x: -330, y: 170, z: 520, scale: 0.84, rotY: 16 }, smoother((t - T.heroIn[0]) / (T.heroIn[1] - T.heroIn[0])));
  heroClone(heroPreview, rec.caps.preview, { x: 1230, y: 130, z: 600, scale: 1.0, rotY: -15 }, smoother((t - T.heroIn[0] - 0.15) / (T.heroIn[1] - T.heroIn[0])));
}
