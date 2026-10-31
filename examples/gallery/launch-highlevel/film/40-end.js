// ---- 50–60 s: 11:59 PM, the day in review; then the lockup.
var RC = [["Voice AI", "Call answered · consult booked", "#188BF6"], ["Conversation AI", "4 conversations answered", "#37CA37"], ["Reviews AI", "Review reply posted", "#FFBC00"],
  ["Content AI", "Post and blog drafted", "#188BF6"], ["Funnel AI", "3-page funnel built", "#37CA37"], ["Workflow AI", "Follow-up automation live", "#FFBC00"]];
var RCE = RC.map(function (r, k) { var e = mk("ui rc", $("rcards"), '<i style="background:' + r[2] + '"></i><div><b>' + r[0] + "</b><span>" + r[1] + "</span></div>"); e.style.left = (270 + (k % 3) * 480) + "px"; e.style.top = (600 + Math.floor(k / 3) * 140) + "px"; return e; });
function poseRecap(t) {
  var on = t >= T.recap[0] + 0.6 && t < T.end[0];
  show("s-recap", on); if (!on) return;
  $("s-recap").style.opacity = (1 - smr(t, T.end[0] - 0.45, T.end[0] - 0.05)).toFixed(3);
  fadeIO("rc1", T.recap[0] + 1.0, 99, t, 24); fadeIO("rc2", T.recap[0] + 1.4, 99, t, 16);
  RCE.forEach(function (e, k) { var u = expOut((t - T.recap[0] - 1.8 - 0.15 * k) / 0.45); e.style.opacity = c01(u * 2).toFixed(3); e.style.transform = "translateY(" + f2((1 - u) * 40) + "px) scale(" + mix(0.9, 1, u).toFixed(3) + ")"; });
}
function poseEnd(t) {
  var on = t >= T.end[0]; show("s-end", on); if (!on) return;
  var l = expOut((t - T.logo) / 0.7);
  $("elogo").style.opacity = c01(l * 2).toFixed(3); $("elogo").style.transform = "translateY(" + f2((1 - l) * 30) + "px) scale(" + mix(0.85, 1, l).toFixed(4) + ")";
  var n = smoother((t - T.title) / 0.8);
  $("etitle").style.opacity = n.toFixed(3); $("etitle").style.letterSpacing = mix(0.02, -0.055, n).toFixed(4) + "em";
  fadeIO("etag", T.title + 0.5, 99, t, 18);
  var c = c01((t - T.url) / 0.45), back = 1 + 2.4 * Math.pow(c - 1, 3) + 1.4 * Math.pow(c - 1, 2);
  $("eurl").style.opacity = c01(c * 3).toFixed(3); $("eurl").style.transform = "scale(" + (c > 0 ? back : 0.5).toFixed(4) + ")";
}
