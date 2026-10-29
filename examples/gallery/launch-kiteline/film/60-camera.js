// ---- the camera: one operated move for all 30 seconds, keyed per channel and joined by monotone cubics.
// dist 1600 with yaw = elev = 0 is the "2D" view: the window frontal at exactly 1:1, so the UI is pixel-sharp while
// someone uses it. Everything else is the "3D" view around it.
//   t      yaw  elev  dist  tx   ty   ox   oy      what the frame is doing
var CAM_KEYS = [
  [0.0, 28, 12, 2500, 0, 0, 0, 0], //       wide through the field of ideas
  [2.4, 14, 7, 2050, 0, 0, 0, 0], //        squaring up as the ideas find their days
  [4.35, 0, 0, 1600, 0, 0, 0, 0], //        frontal 1:1: the real calendar
  [6.4, 0, 0, 1600, 0, 0, 0, 0],
  [7.5, -16, 3, 1760, 0, 0, 300, 10], //    turn: the window right, the headline left
  [8.6, -5, 1, 1640, 0, 0, 100, 0],
  [9.4, 0, 0, 1600, 0, 0, 0, 0], //         frontal for typing and choosing
  [11.95, 0, 0, 1600, 0, 0, 0, 0],
  [12.9, -12, 1, 1360, 330, 0, 250, 0], //  push into the generated prompt
  [13.8, -4, 0, 1500, 150, 0, 80, 0],
  [14.5, 0, 0, 1600, 0, 0, 0, 0], //        frontal: the editor
  [16.9, 0, 0, 1600, 0, 0, 0, 0],
  [17.7, 0, 0, 1330, 400, 0, 0, 0], //      push to the live preview
  [18.7, -15, 2, 1460, 300, 0, 330, 0], //  turn for the headline
  [19.5, 0, 0, 1600, 0, 0, 0, 0], //        frontal: schedule, the card lands, Month
  [21.7, 0, 0, 1600, 0, 0, 0, 0],
  [23.1, 16, 30, 2150, 0, 60, 140, 50], //  the board tilts back; the plan lifts off it
  [25.3, 24, 25, 2200, 0, 60, 140, 50],
  [26.7, -8, 6, 2700, 0, 40, 0, -150], //   the hero composition
  [28.8, -11, 7, 2640, 0, 40, 0, -150],
  [30.0, -11, 7, 2640, 0, 40, 0, -150],
];
var CH = [1, 2, 4, 5, 6, 7].map(function (j) { return curve(CAM_KEYS.map(function (k) { return [k[0], k[j]]; })); });
var LOGD = curve(CAM_KEYS.map(function (k) { return [k[0], Math.log(k[3])]; })); // distance moves in log space
function camAt(t) {
  return { yaw: CH[0](t), elev: CH[1](t), dist: Math.exp(LOGD(t)), tgt: [CH[2](t), CH[3](t), 0], ox: CH[4](t), oy: CH[5](t) };
}
var PROBES = [[0, 0, 0], [-720, -450, 0], [720, -450, 0], [-720, 450, 0], [720, 450, 0]];
function motionOf(from, to) {
  var a = camAt(from), b = camAt(to), far = 0;
  PROBES.forEach(function (p) { var pa = project(p, a), pb = project(p, b); far = Math.max(far, Math.hypot(pb.x - pa.x, pb.y - pa.y)); });
  return far;
}
