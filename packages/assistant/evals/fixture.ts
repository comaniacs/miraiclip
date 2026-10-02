/**
 * The project every assistant case starts from, and the tools it runs with.
 * Shared by the scripted suite (test/cases.test.ts) and the live evals
 * (evals/live.eval.ts), so both judge the same situations.
 *
 *   tracks (bottom → top): video, overlay, titles, music
 *   video:   v1 0–10s · v2 10–15s · v3 15–20s · v4 20–28s   (cuts at 10, 15, 20; all with spare footage)
 *   overlay: logo (image) 5–9s, top-right
 *   titles:  title "Big Buck Bunny" 0.5–4.5s (top) · credits "Thanks for watching" 22–27s (bottom)
 *   music:   m1 "Sunny Steps" 0–28s, volume 0.8
 */
import { createProject, type Project } from "@miraiclip/core";
import { audioToolDefinitions, createAudioLibrary, parseCreativeCommons, runAudioTool, staticProvider, toneGenerator } from "@miraiclip/audio-sources";
import { editorTools, toolsFromDefinitions, type AssistantTool } from "../src/index.js";

export const S = 1_000_000;

export function fixture(): Project {
  const p = createProject({ width: 1920, height: 1080, fps: 30, name: "Bunny trailer" });
  p.transaction(() => {
    p.dispatch({ type: "asset/add", payload: { id: "film", kind: "video", src: "/media/film.mp4", durationUs: 60 * S, width: 1280, height: 720, fps: 30, name: "Big Buck Bunny" } });
    p.dispatch({ type: "asset/add", payload: { id: "logo", kind: "image", src: "/media/logo.png", width: 512, height: 512, name: "Logo" } });
    p.dispatch({ type: "asset/add", payload: { id: "song", kind: "audio", src: "/audio/sunny-steps.webm", durationUs: 30 * S, name: "Sunny Steps" } });
    p.dispatch({ type: "track/add", payload: { id: "video", kind: "video", name: "Video" } });
    p.dispatch({ type: "track/add", payload: { id: "overlay", kind: "video", name: "Overlay" } });
    p.dispatch({ type: "track/add", payload: { id: "titles", kind: "video", name: "Titles" } });
    p.dispatch({ type: "track/add", payload: { id: "music", kind: "audio", name: "Music", index: 0 } });
    const video = (id: string, startS: number, durS: number, trimS: number) =>
      p.dispatch({ type: "clip/add", payload: { kind: "video", id, trackId: "video", assetId: "film", startUs: startS * S, durationUs: durS * S, trimStartUs: trimS * S } });
    video("v1", 0, 10, 0);
    video("v2", 10, 5, 11);
    video("v3", 15, 5, 22);
    video("v4", 20, 8, 30);
    p.dispatch({ type: "clip/add", payload: { kind: "image", id: "logo1", trackId: "overlay", assetId: "logo", startUs: 5 * S, durationUs: 4 * S, transform: { x: 0.9, y: 0.12, scale: 0.3 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "title", trackId: "titles", startUs: 0.5 * S, durationUs: 4 * S, text: "Big Buck Bunny", fontSizePx: 96, transform: { y: 0.2 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "credits", trackId: "titles", startUs: 22 * S, durationUs: 5 * S, text: "Thanks for watching", fontSizePx: 48, transform: { y: 0.85 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "m1", trackId: "music", assetId: "song", startUs: 0, durationUs: 28 * S, volume: 0.8 } });
  });
  p.clearHistory();
  return p;
}

const CC0 = parseCreativeCommons("cc0")!;

/** An offline audio library: a few CC0 entries and test tones (no network). */
export function evalAudioLibrary() {
  const demo = staticProvider({
    id: "demo",
    label: "Demo (CC0)",
    entries: [
      { id: "calm-drift", title: "Calm Drift", kind: "music", durationUs: 32 * S, tags: ["ambient", "calm", "soft"] },
      { id: "lofi-loop", title: "Lo-fi Loop", kind: "music", durationUs: 25 * S, tags: ["lofi", "chill", "beat"] },
      { id: "upbeat-run", title: "Upbeat Run", kind: "music", durationUs: 30 * S, tags: ["upbeat", "happy", "energetic"] },
      { id: "sfx-whoosh", title: "Whoosh", kind: "sfx", durationUs: 0.9 * S, tags: ["transition", "swoosh", "whoosh"] },
      { id: "sfx-pop", title: "Pop", kind: "sfx", durationUs: 0.18 * S, tags: ["ui", "bubble", "pop"] },
      { id: "sfx-ding", title: "Ding", kind: "sfx", durationUs: 2 * S, tags: ["bell", "chime", "ding"] },
    ].map((e) => ({ ...e, kind: e.kind as "music" | "sfx", src: `/audio/${e.id}.webm`, license: CC0, creator: "Miraiclip" })),
  });
  return createAudioLibrary([demo], { generators: [toneGenerator({ latencyMs: 0 })] });
}

/** The tools every case runs with: the editor tools plus audio search / add / generate. */
export function evalTools(): AssistantTool[] {
  const library = evalAudioLibrary();
  return [
    ...editorTools(),
    ...toolsFromDefinitions(audioToolDefinitions(library), (name, input, ctx) =>
      runAudioTool(name, input, { library, project: ctx.project, storeFile: async (_file, fileName) => `/uploads/${fileName}` }),
    ),
  ];
}
