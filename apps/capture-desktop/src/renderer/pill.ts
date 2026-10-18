/** The control pill: time, click-log state, step, pause, discard, finish. */
import type { McApi, PillState } from "../shared/ipc.js";
import { icons } from "./icons.js";

const mc = (window as unknown as { mc: McApi }).mc;
const $ = (id: string) => document.getElementById(id)!;

let state: PillState = { elapsed: "0:00", paused: false, steps: 0, logging: true };
let confirmDiscard = false;

function render() {
  $("time").textContent = state.elapsed;
  $("pill").classList.toggle("paused", state.paused);
  $("pause").innerHTML = state.paused ? icons.play : icons.pause;
  $("pause").title = state.paused ? "Resume (Alt+Shift+P)" : "Pause (Alt+Shift+P)";
  $("step").innerHTML = icons.flag + (state.steps ? `<span class="badge">${state.steps}</span>` : "");
  const log = $("log");
  log.textContent = state.logging ? "click log" : "no click log";
  log.classList.toggle("off", !state.logging);
  log.title = state.logging ? "Clicks, shortcuts and scrolls are being logged" : "Recording without the click log (permission missing or the hook couldn't start)";
}

$("discard").innerHTML = icons.trash;
$("stop").innerHTML = icons.stop;
$("step").onclick = () => mc.command("step");
$("pause").onclick = () => mc.command(state.paused ? "resume" : "pause");
$("stop").onclick = () => mc.command("stop");
$("discard").onclick = () => {
  // Two clicks within 3 s: the first one arms it.
  if (!confirmDiscard) {
    confirmDiscard = true;
    $("discard").title = "Click again to discard this recording";
    $("discard").style.color = "var(--rec)";
    setTimeout(() => {
      confirmDiscard = false;
      $("discard").title = "Discard";
      $("discard").style.color = "";
    }, 3000);
    return;
  }
  mc.command("discard");
};
mc.onPill((s) => {
  state = s;
  render();
});
render();
