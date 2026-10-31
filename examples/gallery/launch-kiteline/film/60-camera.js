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
// the kit joins the keys (monotone cubics, distance in log space); the probes size motion blur and check the rest
var CAM = filmCamera(CAM_KEYS, [[0, 0, 0], [-720, -450, 0], [720, -450, 0], [-720, 450, 0], [720, 450, 0]]);
var camAt = CAM.camAt, motionOf = CAM.motionOf;
