// app-film kit · timeline helpers shared by the picture and the score.
// retypeAt is also the browser's version (the build injects it), so the typing heard and the typing seen agree.

/** the text a retype shows at progress u: backspace the old text (35 % of the time), then type the new */
export function retypeAt(a, u) {
  u = Math.max(0, Math.min(1, u));
  if (u < 0.35) return a.from.slice(0, Math.round(a.from.length * (1 - u / 0.35)));
  return a.to.slice(0, Math.round(a.to.length * (u - 0.35) / 0.65));
}
/** the key presses in every type or retype action, for the typing sounds */
export function keyTimes(actions) {
  const out = [];
  actions.forEach((a) => {
    if (a.kind === "type") for (let k = 1; k <= a.text.length; k++) out.push(a.t + a.dur * k / a.text.length);
    if (a.kind === "retype") {
      const del = Math.round(a.from.length / 4); // backspace held: fewer, faster ticks
      for (let k = 1; k <= del; k++) out.push(a.t + 0.35 * a.dur * k / del);
      for (let k = 1; k <= a.to.length; k++) out.push(a.t + a.dur * (0.35 + 0.65 * k / a.to.length));
    }
  });
  return out.map((t) => +t.toFixed(4));
}
/** check an action list before building: increasing times, known kinds, typing finished before the next action */
export function validateActions(actions, dur) {
  const kinds = new Set(["click", "type", "retype", "focus"]);
  actions.forEach((a, i) => {
    if (!kinds.has(a.kind)) throw new Error(`action ${i}: unknown kind ${a.kind}`);
    if (!a.sel) throw new Error(`action ${i}: no selector`);
    if (a.t < 0 || a.t > dur) throw new Error(`action ${i}: t ${a.t} is outside 0–${dur}`);
    if (i && a.t <= actions[i - 1].t) throw new Error(`action ${i}: t ${a.t} is not after action ${i - 1}`);
    const end = a.t + (a.dur || 0), next = actions[i + 1];
    if (a.dur && next && next.t > a.t && end > next.t) throw new Error(`action ${i}: still typing at ${next.t} s (ends ${end.toFixed(2)})`);
    if (a.kind === "type" && !a.dur) throw new Error(`action ${i}: type needs dur`);
    if (a.kind === "retype" && !(a.from && a.to && a.dur)) throw new Error(`action ${i}: retype needs from, to and dur`);
  });
  return actions;
}
