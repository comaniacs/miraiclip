/**
 * The stage kit for scripted html sequences: one timeline per sequence, a
 * camera, stage-relative units and deterministic seeking, on anime.js v4.
 *
 *   import { registerStageKit } from "@miraiclip/renderer/stage";
 *   registerStageKit(); // once, wherever clips render (editor, server-export harness)
 *
 * A template then asks for it with `data-libs="stage"` and calls
 * `stage.build((tl, S) => { … })`. See src/stage/kit.js for the API.
 */
import { registerScriptedLibraries } from "../html/scripted.js";
import { ANIME_SOURCE, ANIME_VERSION, STAGE_KIT_HASH, STAGE_KIT_SOURCE } from "./stage.generated.js";
import { THREE_SOURCE, THREE_VERSION } from "./three.generated.js";

export { ANIME_SOURCE, ANIME_VERSION, STAGE_KIT_HASH, STAGE_KIT_SOURCE, THREE_SOURCE, THREE_VERSION };
export { lintSequence } from "./lint.js";
export type { SequenceLintFinding, SequenceLintResult } from "./lint.js";

/**
 * Register `anime`, `stage` and `three` as scripted libraries. `three` is three.js with RoundedBoxGeometry,
 * RoomEnvironment and mergeGeometries, as a global THREE; a sequence asks for it with data-libs="stage three"
 * and draws each frame from the time in tl.frame(draw).
 */
export function registerStageKit(): void {
  // Hosts that bundle the kit carry its fingerprint, so a stale bundle can be told from a current one.
  (globalThis as { __miraiclipStageKitHash?: string }).__miraiclipStageKitHash = STAGE_KIT_HASH;
  registerScriptedLibraries({
    anime: ANIME_SOURCE,
    stage: { code: STAGE_KIT_SOURCE, requires: ["anime"] },
    three: THREE_SOURCE,
  });
}
