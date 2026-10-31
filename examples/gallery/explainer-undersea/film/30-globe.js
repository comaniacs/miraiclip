// ---- the globe: a bubble opens on the Earth, and cable wraps round it 35 times (1.4 million+ km ÷ ~40,075 km).
var STARS = []; for (var s = 0; s < 70; s++) { var st = mk("", $("gstars")); st.style.left = (rnd() * W).toFixed(0) + "px"; st.style.top = (rnd() * H).toFixed(0) + "px"; STARS.push([st, rnd() * 6]); }
var WRAPS = []; for (s = 0; s < 35; s++) {
  var e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  e.setAttribute("rx", "286"); e.setAttribute("ry", (30 + (s * 37) % 110).toFixed(0)); e.setAttribute("fill", "none");
  e.setAttribute("stroke", ["#ffd23f", "#ff6b6b", "#ffffff"][s % 3]); e.setAttribute("stroke-width", "4"); e.setAttribute("stroke-dasharray", "1900");
  e.setAttribute("transform", "rotate(" + (s * 180 / 35).toFixed(2) + ")"); $("wraps").appendChild(e); WRAPS.push(e);
}
function poseGlobe(t) {
  var G = T.globe, on = t >= G[0] && t < G[1] + 0.05; show("globe", on); if (!on) return;
  // in: a bubble grows from the seabed; out: it shrinks to a bubble and floats away
  var rin = 2300 * expOut((t - G[0]) / 0.55), out = smoother((t - (G[1] - 0.45)) / 0.45);
  var r = mix(rin, 40, out), cx = 960, cy = mix(1000, -60, out) + (1 - c01((t - G[0]) / 0.55)) * 0;
  $("globe").style.clipPath = r > 2200 ? "none" : "circle(" + f2(r) + "px at " + cx + "px " + f2(t < G[0] + 0.55 ? 1000 : cy) + "px)";
  STARS.forEach(function (x) { x[0].style.opacity = (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + x[1]))).toFixed(3); });
  var p = expOut((t - G[0] - 0.2) / 0.6);
  $("earth").style.transform = "scale(" + mix(0.3, 1, p).toFixed(4) + ") rotate(" + ((t - G[0]) * 6).toFixed(2) + "deg)";
  var n = 0;
  WRAPS.forEach(function (w, k) { var a = T.wraps[0] + k * (T.wraps[1] - T.wraps[0]) / 35, u = c01((t - a) / 0.35); if (t >= a) n = k + 1; w.setAttribute("stroke-dashoffset", (1900 * (1 - u)).toFixed(0)); w.setAttribute("opacity", u > 0 ? 1 : 0); });
  setHtml($("gn"), String(n));
}
