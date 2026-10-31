// ---- one camera take: [t, yaw, elev, dist, tx, ty, ox, oy] through the kit's monotone curves
var CAM = filmCamera([
  [0.0, 0, 4, 520, 0, 120, 0, 0], //         macro on the rising bubble
  [3.6, 6, 10, 560, 0, -440, 0, 0], //       at the lid as it pops
  [5.4, 16, 26, 1150, 0, -380, 120, 0], //   pulling back and down the can
  [8.6, -10, 10, 1500, 0, -230, 330, 20], // 3/4, the can right, the name left
  [10.4, 0, 5, 1700, -320, -220, 0, 20], // frontal and wide: the label peels into a card
  [14.4, 6, 6, 1760, -320, -220, 0, 20],
  [16.4, 40, -4, 1250, 0, -250, 0, 0], //   low orbit through the citrus
  [20.4, 118, 4, 1220, 0, -250, 0, 0],
  [23.0, 172, 22, 1650, 0, -260, 0, 0], //  rising for the climax
  [25.8, 196, 10, 1500, 0, -230, 340, 20], // hero: the can right, the lockup left
  [28.6, 200, 9, 1480, 0, -230, 340, 20],
  [30.0, 200, 9, 1480, 0, -230, 340, 20],
], [[0, -220, 0], [150, -440, 0], [-150, 0, 0], [0, -220, 300]]);
var camAt = CAM.camAt;
// the can turns to show itself in the introduction, and otherwise keeps its label toward the camera
function spinAt(t, c) { return -c.yaw + 35 * Math.sin(Math.PI * c01((t - 4.4) / 4.6)) + 40 * Math.sin(Math.PI * c01((t - 15.6) / 8.6)); }
