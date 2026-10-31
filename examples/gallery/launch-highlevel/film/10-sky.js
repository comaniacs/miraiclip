// ---- the day: a 24-hour sky (gradient, sun, moon, stars, a skyline that lights up at night) and the rolling clock.
function show(id, on) { $(id).style.display = on ? "block" : "none"; }
function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixc(a, b, u) { var x = hex2rgb(a), y = hex2rgb(b); return "rgb(" + x.map(function (v, i) { return Math.round(mix(v, y[i], u)); }).join(",") + ")"; }
var SKY = [[0, "#050816", "#0d1433"], [5, "#0b1030", "#2a2457"], [6.5, "#2c3e7a", "#f59e8b"], [8, "#3b82d6", "#ffd2a8"], [11, "#2f86f0", "#a9d8ff"],
  [15, "#3a7ee0", "#b9dcff"], [17.2, "#3c55a5", "#ffbe7a"], [19, "#2a2463", "#ff7b5c"], [20.5, "#0c1236", "#2b2a5e"], [24, "#050816", "#0d1433"]];
function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  for (var i = 0; i < SKY.length - 1; i++) if (h <= SKY[i + 1][0]) { var u = sm((h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])); return [mixc(SKY[i][1], SKY[i + 1][1], u), mixc(SKY[i][2], SKY[i + 1][2], u)]; }
  return [SKY[0][1], SKY[0][2]];
}
function nightAt(h) { return 1 - smr(h, 5, 7) + smr(h, 18.5, 20.5); }

// the hour at time t: it holds through each scene (a few minutes pass) and races forward in each transition
var HOURS = [[0, 2.2333], [T.reveal[1], 2.24]].concat(SCENES.map(function (s) { return [s[1], s[2]]; })).concat([[T.recap[0], 23.983]]);
function hourAt(t) {
  var h = HOURS[0][1];
  for (var i = 1; i < HOURS.length; i++) {
    var S = HOURS[i][0];
    if (t >= S) { var prev = h + 0.05; h = mix(prev, HOURS[i][1], smoother((t - S) / 0.9)); if (t > S + 0.9 && i < HOURS.length - 1) h += 0.06 * c01((t - S - 0.9) / 6); }
    else if (i === 1) h = mix(HOURS[0][1], HOURS[0][1] + 0.0167, c01(t / 5)); // 2:14 → 2:15 during the hook
  }
  return Math.min(h, 23.983);
}
function clockText(h) {
  var hh = Math.floor(h), mm = Math.floor((h - hh) * 60 + 1e-6), ap = hh >= 12 ? "PM" : "AM", h12 = hh % 12 || 12;
  return (h12 < 10 ? "0" : "") + h12 + ":" + (mm < 10 ? "0" : "") + mm + "<small>" + ap + "</small>";
}

// stars and the skyline, built once from a seeded generator
var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(11);
var STARS = []; for (var i = 0; i < 150; i++) { var e = mk("", $("stars"), ""); e.style.left = (rnd() * W).toFixed(0) + "px"; e.style.top = (rnd() * 700).toFixed(0) + "px"; e.style.transform = "scale(" + (0.5 + rnd()).toFixed(2) + ")"; STARS.push([e, rnd() * 6]); }
var WINDOWS = [];
for (var x = 0; x < W;) {
  var bw = 70 + Math.floor(rnd() * 110), bh = 60 + Math.floor(rnd() * 150), b = mk("", $("city"), "");
  b.style.left = x + "px"; b.style.width = bw + "px"; b.style.height = bh + "px";
  for (var wy = 14; wy < bh - 16; wy += 22) for (var wx = 12; wx < bw - 12; wx += 18) if (rnd() < 0.42) { var wi = document.createElement("i"); wi.style.left = wx + "px"; wi.style.top = wy + "px"; b.appendChild(wi); WINDOWS.push([wi, rnd()]); }
  x += bw + 4;
}
function poseSky(t) {
  var tt = Math.min(t, T.rest[0]), h = hourAt(tt), c = skyAt(h), n = nightAt(h);
  $("sky").style.background = "linear-gradient(180deg," + c[0] + " 0%," + c[1] + " 100%)";
  $("haze").style.background = "radial-gradient(ellipse 70% 100% at 50% 100%," + c[1] + " 0%,transparent 70%)";
  STARS.forEach(function (s) { s[0].style.opacity = (n * (0.55 + 0.45 * Math.sin(tt * 2.2 + s[1]))).toFixed(3); });
  var p = c01((h - 5.6) / 13.8), sx = 1040 + p * 760, sy = 980 - Math.sin(Math.PI * p) * 820 // the sun keeps to the right, behind the product cards, so the type stays legible;
  $("sun").style.transform = "translate(" + f2(sx - 85) + "px," + f2(sy - 85) + "px)"; $("sun").style.opacity = (1 - n).toFixed(3);
  var hm = h < 12 ? h + 24 : h, q = c01((hm - 19) / 11), mx = 200 + q * 1500, my = 820 - Math.sin(Math.PI * q) * 640;
  $("moon").style.transform = "translate(" + f2(mx - 55) + "px," + f2(my - 55) + "px)"; $("moon").style.opacity = n.toFixed(3);
  [].forEach.call($("city").children, function (b) { b.style.background = mixc("#1d2b55", "#070b1c", n); });
  WINDOWS.forEach(function (w) { w[0].style.opacity = (n * (w[1] < 0.8 ? 0.9 : 0.25)).toFixed(3); });
}

// the clock: big in the hook, big and centred while time races between scenes, small top-left otherwise
var BIGS = SCENES.map(function (s) { return s[1]; }).concat([T.recap[0]]);
function poseClock(t) {
  var el = $("clock"); setHtml(el, clockText(hourAt(t)));
  var b = 0; BIGS.forEach(function (S) { b = Math.max(b, smr(t, S - 0.35, S) * (1 - smr(t, S + 0.75, S + 1.15))); });
  var hookB = 1 - smr(t, 4.6, 5.3), fs, x, y;
  var small = [96, 66, 44];
  if (hookB > 0) { fs = mix(small[2], 250, hookB); el.style.fontSize = f2(fs) + "px"; x = mix(small[0], 92, hookB); y = mix(small[1], 230, hookB); }
  else { fs = mix(small[2], 300, b); el.style.fontSize = f2(fs) + "px"; x = mix(small[0], 960 - el.offsetWidth / 2, b); y = mix(small[1], 540 - fs * 0.55, b); }
  el.style.left = f2(x) + "px"; el.style.top = f2(y) + "px";
  el.style.opacity = (1 - smr(t, T.end[0] - 0.4, T.end[0] + 0.1)).toFixed(3);
}
