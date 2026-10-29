// ---- the camera: one operated move for all 30 seconds. Each channel is a monotone cubic through its keys, so the
// move never stops between beats and never overshoots a framing.
//   t      yaw   elev  dist  tgtY  ox    oy      what the frame is doing
var CAM_KEYS = [
  [0.0, -24, 89, 470, -110, 380, 0], //    top-down on the glass, the ring drawing itself in the dark
  [3.5, 8, 84, 560, -110, 340, 0], //      still above, drifting round as the ring closes
  [5.3, 32, 30, 1020, -70, 320, 40], //    the tilt down to the hero angle as the light sweeps in
  [8.3, 16, 19, 900, -62, 300, 40], //    a slow hero orbit; the name holds on the left
  [9.6, -2, 9, 580, -70, 150, 150], //     the push into the knurled edge (macro)
  [10.5, -20, 12, 680, -86, 170, 70], //   tracking along the edge
  [11.6, -30, 18, 1380, -150, 330, 20], // pulled back for the exploded view; callouts on the left
  [13.0, -37, 20, 1320, -140, 330, 20],
  [14.4, -28, 48, 980, -104, 330, 10], //  up and over the face to watch it turn
  [17.2, -12, 58, 880, -106, 320, 10],
  [19.6, -2, 61, 990, -100, 280, 20], //   timer holds; the frame starts to open
  [21.2, 8, 63, 2080, -60, 0, 30], //      the wide: the dial among the noise
  [24.0, 22, 56, 2050, -60, 0, 30],
  [25.6, 31, 30, 1480, -60, 0, -50], //    descending back to the hero angle
  [27.0, 38, 19, 1160, -56, 0, -112],
  [28.6, 41, 18, 1110, -56, 0, -112], //   the final frame, held
  [30.0, 41, 18, 1110, -56, 0, -112],
];
var CH = ["yaw", "elev", "dist", "ty", "ox", "oy"].map(function (_, j) { return curve(CAM_KEYS.map(function (k) { return [k[0], k[j + 1]]; })); });
// distance moves in log space, so push-ins and pull-backs feel constant-speed
var LOGD = curve(CAM_KEYS.map(function (k) { return [k[0], Math.log(k[3])]; }));
function camAt(t) {
  return { yaw: CH[0](t), elev: CH[1](t), dist: Math.exp(LOGD(t)), tgt: [0, CH[3](t), 0], ox: CH[4](t), oy: CH[5](t) };
}
// how far the picture moves between two instants, in stage px, for motion blur and the declared rest
var PROBES = [[0, -60, 0], [214, -60, 0], [-214, -60, 0], [0, -60, 214], [0, -110, -188], [900, 0, 900], [-900, 0, -900]];
function motionOf(from, to) {
  var a = camAt(from), b = camAt(to), far = 0;
  PROBES.forEach(function (p) { var pa = project(p, a), pb = project(p, b); far = Math.max(far, Math.hypot(pb.x - pa.x, pb.y - pa.y)); });
  return far;
}
