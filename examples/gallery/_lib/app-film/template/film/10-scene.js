// ---- the __TITLE__ film on the app-film kit. Four parts, each a few lines: the app, the camera, the moments, the frame.

// 1 · the real app, mounted fresh and replayed every frame
var winEl = $("win"), world = $("world");
var R = appReplay({ slot: $("appslot"), bar: BAR, actions: ACTIONS, mount: function (host) { AppUI.mount(host, { storage: null }); } });

// 2 · one camera move: [t, yaw, elev, dist, tx, ty, ox, oy]. dist 1600 at yaw = elev = 0 is the frontal 1:1 view for
// interaction; the rest orbits the window.
var CAM = filmCamera([
  [0.0, 26, 10, 2400, 0, 0, 380, 20], //   3D: the window turned away, the hook on the left
  [2.6, 10, 4, 1900, 0, 0, 120, 0],
  [3.0, 0, 0, 1600, 0, 0, 0, 0], //        frontal 1:1 while someone uses it
  [6.6, 0, 0, 1600, 0, 0, 0, 0],
  [8.2, -18, 18, 2100, 0, 40, 280, 30], // orbit for the second headline
  [10.4, -8, 6, 2600, 0, 0, 0, -150], //   the hero, lockup below
  [13.4, -10, 7, 2560, 0, 0, 0, -150],
  [15.0, -10, 7, 2560, 0, 0, 0, -150],
], [[0, 0, 0], [-720, -450, 0], [720, -450, 0], [-720, 450, 0], [720, 450, 0]]);
var camAt = CAM.camAt;

// 3 · the moments: cursor and clicks, a wipe-up on the list when the task lands, the accent line under the new task
var cursor = $("cursor"), ripple = $("ripple"), line = $("kline");
function poseMoments(t, rec) {
  poseCursor(cursor, ripple, t, rec, R, ACTIONS, { home: { x: 1100, y: 700 }, visible: [2.8, 6.6] });
  var last = R.q(".ap-list li:last-child");
  underline($("hl"), last && t > 4.8 ? R.rect(last.querySelector("span")) : null, smr(t, 4.85, 5.1) * (1 - smr(t, 6.4, 6.8)));
  var a = R.q('[data-act="add"]'), b = last;
  if (a && b && t > 4.8) {
    var ra = R.rect(a), rb = R.rect(b);
    drawLine(line, [w2w(ra.x + ra.w / 2, ra.y + ra.h, 0), w2w(ra.x + ra.w / 2, rb.y - 20, 60), w2w(rb.x + rb.w, rb.y + rb.h / 2, 0)], camAt(t), smoother((t - 4.8) / 0.5), 1 - smr(t, 5.6, 6.0));
  } else line.style.opacity = 0;
}
function poseType(t) {
  lineIO("h1", T.head1, t); lineIO("h2", T.head2, t); lineIO("tag", [T.tag, 99], t);
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3); $("lock").style.transform = "translateY(" + f2((1 - u) * 26) + "px)";
  fadeIO("cta", T.cta, 99, t, 10);
}

// 4 · the frame, and what the checks look at
function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  var rec = R.replay(t);
  winEl.style.opacity = smr(t, T.appIn[0], T.appIn[1]).toFixed(3);
  poseMoments(t, rec);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the app window", function (t) { var c = camAt(t), s = project([0, 0, 0], c); return { x: s.x, y: s.y, r: 300 * s.k }; }, { minPx: 120 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", T.head1[0]).label("type", 3.2).label("add", 4.8).label("done", 5.9).label("orbit", T.head2[0]).label("lockup", T.title);
ACTIONS.forEach(function (a, i) { if (a.kind === "click") tl.hit("click" + i, a.t, { kind: "click" }); });
