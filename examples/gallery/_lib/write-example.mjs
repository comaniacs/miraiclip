// Shared by the continuous-shot gallery builds: wraps one scripted html sequence in a project and writes
// sequence.html and video.miraiclip.json next to the calling build.mjs.
import fs from "node:fs";
import { createProject } from "../../../packages/core/dist/index.js";

export function writeExample(buildUrl, { html, width = 1920, height = 1080, duration, id }) {
  fs.writeFileSync(new URL("./sequence.html", buildUrl), html);
  const project = createProject({ width, height, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "html", id, trackId: "v1", startUs: 0, durationUs: duration * 1_000_000, template: html, scripted: true } });
  });
  fs.writeFileSync(new URL("./video.miraiclip.json", buildUrl), JSON.stringify(project.toJSON(), null, 2) + "\n");
  console.log("wrote sequence.html and video.miraiclip.json");
}
