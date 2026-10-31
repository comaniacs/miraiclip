// ---- one camera move for the whole film: [t, yaw, elev, dist, tx, ty, ox, oy], joined by the kit's monotone
// cubics (distance in log space). It starts as a macro over a blank page and never stops until the held last frame.
var CAM = filmCamera([
  [0.0, 0, 88, 760, 790, 0, 0, 0], //        top-down macro: the blank page, the first crease
  [3.4, 10, 64, 1150, 800, -60, 0, 0], //    tilting off as the first fold stands
  [6.4, 24, 38, 2050, 760, -60, 0, 40], //   wide 3/4: the city folds up in a wave
  [8.8, 34, 26, 2250, 720, -70, 0, 40],
  [10.4, 52, 9, 1050, 900, -110, 140, 30], // dive to street level, toward the tower
  [12.7, 66, 7, 900, 1000, -150, 160, 20],
  [14.8, 88, 13, 1350, 900, -150, 0, 20], //  out of the streets as the light starts to warm
  [17.6, 118, 22, 1900, 500, -200, 0, 20], // tracking the birds up and over
  [20.6, 150, 46, 2700, 200, -80, 0, 30],
  [23.4, 180, 76, 3400, 0, 0, 0, 30], //      the whole spread from above: the plan and the place
  [25.8, 192, 62, 3150, 300, 0, 0, 0],
  [28.6, 206, 40, 2650, 800, -20, 0, -110], // the closed book, the hero
  [30.0, 206, 40, 2650, 800, -20, 0, -110],
], [[800, 0, 0], [0, 0, -550], [1600, 0, 550], [-800, 0, 0], [800, -300, 0]]);
var camAt = CAM.camAt;
