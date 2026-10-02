import { describe, expect, it } from "vitest";
import { ANIMATION_PRESETS, EFFECT_CATALOG, animationCommands, builtinTransitionParamSchemas, createProject, readAnimation } from "@miraiclip/core";
import { createAssistant, describeForAssistant, editorTools, scriptedChatModel, type AssistantTool } from "../src/index.js";
import { fixture, S } from "../evals/fixture.js";

const tools = Object.fromEntries(editorTools().map((t) => [t.name, t])) as Record<string, AssistantTool>;
const run = (name: string, input: Record<string, unknown>, project = fixture()) => ({ project, out: tools[name]!.run(input, { project }) as Exclude<ReturnType<AssistantTool["run"]>, Promise<unknown>> });

describe("apply_commands is strict", () => {
  it.each([
    ["clip/move with `at`", { type: "clip/move", payload: { clipId: "v4", at: 25 * S } }, /"at"/],
    ["track/set-property with property/value", { type: "track/set-property", payload: { trackId: "titles", property: "hidden", value: false } }, /"property", "value"/],
    ["text clip with an audio-only field", { type: "clip/add", payload: { kind: "text", id: "t", trackId: "titles", startUs: 0, durationUs: S, text: "x", fadeInUs: 1000 } }, /"fadeInUs"/],
    ["unknown transform field", { type: "clip/set-property", payload: { clipId: "title", transform: { size: 2 } } }, /"transform.size"/],
  ])("rejects %s instead of silently ignoring it", (_name, command, re) => {
    const { project, out } = run("apply_commands", { commands: [{ type: "clip/remove", payload: { clipId: "logo1" } }, command] });
    expect(out.ok).toBe(false);
    const message = String((!out.ok && (out.error as { error: string }).error) || "");
    expect(message).toMatch(re);
    expect(message).toMatch(/fields are/);
    expect(project.getState().doc.clips.logo1).toBeDefined(); // nothing applied
  });

  it("reports commands that changed nothing", () => {
    const { out } = run("apply_commands", { commands: [{ type: "clip/set-property", payload: { clipId: "v1", volume: 1 } }, { type: "clip/set-property", payload: { clipId: "v2", volume: 0.5 } }] });
    expect(out).toMatchObject({ ok: true, result: { applied: 1, unchanged: [{ index: 0, type: "clip/set-property" }] }, changes: ["Changed volume of clip v2"] });
  });

  it("accepts valid custom-kind and union payloads", () => {
    const { out } = run("apply_commands", { commands: [{ type: "clip/add", payload: { kind: "text", id: "t", trackId: "titles", startUs: 10 * S, durationUs: S, text: "ok", fontWeight: 700, transform: { y: 0.5 } } }] });
    expect(out.ok).toBe(true);
  });
});

describe("add_effect / remove_effects", () => {
  it("adds catalog kinds to several clips, rejects unknown kinds and audio", () => {
    const { project, out } = run("add_effect", { clipIds: ["v1", "v2"], kind: "mono" });
    expect(out).toMatchObject({ ok: true, changes: ["Added Black & White to v1, v2"] });
    expect(project.getState().doc.clips.v2!.effects![0]!.kind).toBe("mono");
    expect(run("add_effect", { clipIds: ["v1"], kind: "grayscale" }).out.ok).toBe(false);
    expect(run("add_effect", { clipIds: ["m1"], kind: "mono" }).out.ok).toBe(false);
    const { out: removed } = run("remove_effects", { clipIds: ["v1", "v2"] }, project);
    expect(removed).toMatchObject({ ok: true, result: { removed: 2 } });
    expect(project.getState().doc.clips.v1!.effects ?? []).toHaveLength(0);
  });
  it("lists every kind with its params in the description", () => {
    expect(tools.add_effect!.description).toMatch(/mono \(Black & White/);
    expect(tools.add_effect!.description).toMatch(/colorAdjust \(Color Adjust: brightness -1–1, 0/);
  });
});

describe("trim_clip / close_gaps", () => {
  it("removeFromStart keeps the end and advances the source", () => {
    const { project } = run("trim_clip", { clipId: "v4", removeFromStart: 2 });
    expect(project.getState().doc.clips.v4).toMatchObject({ startUs: 22 * S, durationUs: 6 * S, trimStartUs: 32 * S });
  });
  it("ripple keeps the start and pulls later clips up", () => {
    const { project } = run("trim_clip", { clipId: "v2", removeFromEnd: 2, ripple: true });
    const d = project.getState().doc.clips;
    expect(d.v2).toMatchObject({ startUs: 10 * S, durationUs: 3 * S });
    expect([d.v3!.startUs, d.v4!.startUs]).toEqual([13 * S, 18 * S]);
  });
  it("refuses to trim a clip away", () => {
    expect(run("trim_clip", { clipId: "v2", removeFromStart: 6 }).out.ok).toBe(false);
  });
  it("close_gaps packs a track", () => {
    const p = fixture();
    p.dispatch({ type: "clip/remove", payload: { clipId: "v3" } });
    const { out } = run("close_gaps", { trackId: "video" }, p);
    expect(out.ok).toBe(true);
    expect(p.getState().doc.clips.v4!.startUs).toBe(15 * S);
    expect(run("close_gaps", { trackId: "video" }).out).toMatchObject({ ok: true, result: { moved: 0 } });
  });
});

describe("describeForAssistant", () => {
  it("shows what relative edits need", () => {
    const p = fixture();
    for (const c of animationCommands(p.getState().doc.clips.title!, { in: { preset: "in:pop", durationUs: 600_000, easing: "smooth" } })) p.dispatch(c);
    p.dispatch({ type: "effect/add", payload: { clipId: "v2", kind: "mono", effectId: "bw" } });
    const text = describeForAssistant(p.getState().doc);
    expect(text).toContain('titles = "Titles"');
    expect(text).toMatch(/- title: text on titles · 0\.5–4\.5s · x 0\.5 y 0\.2 scale 1 opacity 1 · font sans-serif 96px color #ffffff · animation Pop in/);
    expect(text).toMatch(/- logo1: image on overlay · 5–9s · x 0\.9 y 0\.12 scale 0\.3/);
    expect(text).toMatch(/- v1: video on video · 0–10s · .* volume 1 · source from 0s/);
    expect(text).toMatch(/- v2: .* effects mono#bw/);
    expect(describeForAssistant(createProject({ width: 1, height: 1, fps: 1 }).toJSON())).not.toContain("clip details");
  });
});

describe("every catalog entry works through the tools", () => {
  it.each(EFFECT_CATALOG.map((e) => [e.kind] as const))("effect %s applies with its defaults", (kind) => {
    const { project, out } = run("add_effect", { clipIds: ["v2", "title"], kind });
    expect(out.ok).toBe(true);
    expect(project.getState().doc.clips.v2!.effects![0]!.kind).toBe(kind);
  });
  it.each(ANIMATION_PRESETS.map((p) => [p.id] as const))("animation %s applies and reads back", (id) => {
    const [slot, name] = id.split(":") as ["in" | "loop" | "out", string];
    const { project, out } = run("animate_clip", { clipId: "title", [slot]: name });
    expect(out.ok).toBe(true);
    expect(readAnimation(project.getState().doc.clips.title!).recipe[slot]?.preset).toBe(id);
  });
  it.each(Object.keys(builtinTransitionParamSchemas).map((k) => [k] as const))("transition %s applies on every cut", (kind) => {
    const { project, out } = run("add_transition", { kind, allCuts: true });
    expect(out.ok).toBe(true);
    expect(Object.values(project.getState().doc.transitions).map((t) => t.kind)).toEqual([kind, kind, kind]);
  });
});

describe("errors that steer the model (from the second live eval)", () => {
  const err = (out: { ok: boolean; error?: unknown }) => JSON.stringify(!out.ok && out.error);

  it("a tool name inside apply_commands says to call the tool; nothing in the batch applies", () => {
    const { project, out } = run("apply_commands", { commands: [{ type: "clip/remove", payload: { clipId: "v3" } }, { type: "close_gaps", payload: { trackId: "video" } }] });
    expect(out.ok).toBe(false);
    expect(err(out)).toMatch(/is a tool/);
    expect(err(out)).toMatch(/not even the commands before it/);
    expect(project.getState().doc.clips.v3).toBeDefined();
  });

  it("audio fades on a text clip point at animate_clip", () => {
    const { out } = run("apply_commands", { commands: [{ type: "clip/set-property", payload: { clipId: "credits", fadeOutUs: S } }] });
    expect(err(out)).toMatch(/animate_clip/);
  });

  it("missing assets point at add_audio", () => {
    const { out } = run("apply_commands", { commands: [{ type: "clip/add", payload: { kind: "audio", id: "m2", trackId: "music", assetId: "calm-drift", startUs: 0, durationUs: S } }] });
    expect(err(out)).toMatch(/add_audio/);
  });

  it("html params must match the template's placeholders", () => {
    const project = fixture();
    const template = '<div style="background:{{color}}"></div>';
    expect(run("apply_commands", { commands: [{ type: "clip/add", payload: { kind: "html", id: "bg", trackId: "overlay", startUs: 0, durationUs: S, template, params: { background: "#f00" } } }] }, project).out.ok).toBe(false);
    expect(run("apply_commands", { commands: [{ type: "clip/add", payload: { kind: "html", id: "bg", trackId: "overlay", startUs: 0, durationUs: S, template, params: { color: "#f00" } } }] }, project).out.ok).toBe(true);
    const bad = run("apply_commands", { commands: [{ type: "clip/set-property", payload: { clipId: "bg", params: { backgroundColor: "#800" } } }] }, project).out;
    expect(err(bad)).toMatch(/Its placeholders: color/);
    expect(describeForAssistant(project.toJSON())).toMatch(/params \{"color":"#f00"\} \(template placeholders: color\)/);
  });

  it("add_transition refuses clips on different tracks and times far from any cut", () => {
    const across = run("add_transition", { kind: "crossDissolve", fromClipId: "title", toClipId: "v1" });
    expect(err(across.out)).toMatch(/SAME track/);
    const far = run("add_transition", { kind: "crossDissolve", nearSeconds: 4.5 });
    expect(err(far.out)).toMatch(/no cut near 4.5s/);
    expect(far.project.getState().doc.transitions).toEqual({});
    expect(run("add_transition", { kind: "crossDissolve", nearSeconds: 10.5 }).out.ok).toBe(true);
  });
});

describe("trim_clip edges, set_effects_enabled, set_keyframes", () => {
  it("trim_clip startSeconds / endSeconds place both edges", () => {
    const { project, out } = run("trim_clip", { clipId: "logo1", startSeconds: 0, endSeconds: 28 });
    expect(out.ok).toBe(true);
    expect(project.getState().doc.clips.logo1).toMatchObject({ startUs: 0, durationUs: 28 * S });
    const v2 = run("trim_clip", { clipId: "v2", startSeconds: 9 }); // overlapping v1 is the model's call; source moves back 1 s
    expect(v2.project.getState().doc.clips.v2).toMatchObject({ startUs: 9 * S, durationUs: 6 * S, trimStartUs: 10 * S });
    expect(run("trim_clip", { clipId: "v1", startSeconds: 0.5, removeFromEnd: 1 }).out.ok).toBe(false);
    const p2 = fixture();
    p2.dispatch({ type: "clip/remove", payload: { clipId: "v1" } });
    p2.dispatch({ type: "clip/add", payload: { kind: "video", id: "v0", trackId: "video", assetId: "film", startUs: 5 * S, durationUs: 5 * S, trimStartUs: 0 } });
    expect(JSON.stringify(run("trim_clip", { clipId: "v0", startSeconds: 2 }, p2).out)).toMatch(/media has only 0s before/);
  });

  it("set_effects_enabled turns effects off and on without removing them", () => {
    const project = fixture();
    project.dispatch({ type: "effect/add", payload: { clipId: "v2", kind: "sepia", effectId: "fx" } });
    expect(run("set_effects_enabled", { clipIds: ["v2"], kind: "sepia", enabled: false }, project).out).toMatchObject({ ok: true, changes: ["Turned off 1 effect"] });
    expect(project.getState().doc.clips.v2!.effects).toMatchObject([{ kind: "sepia", enabled: false }]);
    expect(describeForAssistant(project.toJSON())).toMatch(/sepia#fx \(off\)/);
    expect(run("set_effects_enabled", { clipIds: ["v2"], enabled: false }, project).out).toMatchObject({ ok: true, result: { changed: 0 } });
  });

  it("set_keyframes takes timeline seconds and replaces the property's keyframes", () => {
    const project = fixture();
    const spin = run("set_keyframes", { clipId: "logo1", property: "rotation", points: [{ atSeconds: 5, value: 0 }, { atSeconds: 9, value: 360 }] }, project).out;
    expect(spin).toMatchObject({ ok: true, changes: ["logo1: rotation 5s 0 → 9s 360"] });
    expect(project.getState().doc.clips.logo1!.animations!.rotation!.map((k) => [k.timeUs, k.value])).toEqual([[0, 0], [4 * S, 360]]);
    run("set_keyframes", { clipId: "logo1", property: "rotation", points: [{ atSeconds: 6, value: 90 }, { atSeconds: 7, value: 0 }, { atSeconds: 8, value: 90 }] }, project);
    expect(project.getState().doc.clips.logo1!.animations!.rotation).toHaveLength(3);
    // Constant values are not keyframes: the model is told to set them directly.
    for (const points of [[{ atSeconds: 5, value: 45 }], [{ atSeconds: 5, value: 45 }, { atSeconds: 9, value: 45 }]]) {
      const flat = run("set_keyframes", { clipId: "logo1", property: "rotation", points }, project).out;
      expect(JSON.stringify(flat)).toMatch(/clip\/set-property \{ transform: \{ rotation \} \}/);
    }
    expect(JSON.stringify(run("set_keyframes", { clipId: "m1", property: "volume", points: [{ atSeconds: 0, value: 0.3 }] }).out)).toMatch(/clip\/set-property \{ volume \}.*keyframe\/clear/);
    const duck = run("set_keyframes", { clipId: "m1", property: "volume", points: [{ atSeconds: 9.5, value: 0.8 }, { atSeconds: 10, value: 0.2 }] }, project).out;
    expect(duck.ok).toBe(true);
    expect(describeForAssistant(project.toJSON())).toMatch(/volume keyframes 9.5s=0.8, 10s=0.2/);
    expect(run("set_keyframes", { clipId: "logo1", property: "volume", points: [{ atSeconds: 6, value: 1 }] }).out.ok).toBe(false);
    expect(run("set_keyframes", { clipId: "logo1", property: "x", points: [{ atSeconds: 20, value: 1 }] }).out.ok).toBe(false);
  });

  it("describeForAssistant shows track flags and caption styles", () => {
    const project = fixture();
    project.dispatch({ type: "track/set-property", payload: { trackId: "music", solo: true } });
    project.dispatch({ type: "track/add", payload: { id: "captions", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 0, durationUs: 2 * S, words: [{ text: "Sing", startUs: 0, durationUs: S }, { text: "along", startUs: S, durationUs: S }] } });
    const text = describeForAssistant(project.toJSON());
    expect(text).toMatch(/music = "Music" \(solo\)/);
    expect(text).toMatch(/words "Sing along" · style preset \w+/);
  });
});

describe("set_background", () => {
  it("adds a full-length background at the bottom, recolors it, and removes it", () => {
    const project = fixture();
    const added = run("set_background", { color: "#1E3A8A" }, project).out;
    expect(added).toMatchObject({ ok: true, changes: ["Added a background: #1E3A8A, 0s–28s"] });
    const doc = () => project.getState().doc;
    expect(doc().trackOrder[0]).toBe("background");
    expect(doc().clips["background-clip"]).toMatchObject({ kind: "html", startUs: 0, durationUs: 28 * S, params: { color: "#1E3A8A" } });

    expect(run("set_background", { color: "#991B1B" }, project).out).toMatchObject({ ok: true, changes: ["Changed the background to #991B1B, 0s–28s"] });
    expect(doc().clips["background-clip"]).toMatchObject({ params: { color: "#991B1B" }, durationUs: 28 * S });
    run("set_background", { color: "#991B1B", fromSeconds: 20 }, project);
    expect(doc().clips["background-clip"]).toMatchObject({ startUs: 20 * S, durationUs: 8 * S });
    expect(run("set_background", { color: "#991B1B", fromSeconds: 20 }, project).out).toMatchObject({ ok: true, result: { note: expect.stringMatching(/already/) } });

    expect(run("set_background", { color: "none" }, project).out).toMatchObject({ ok: true, changes: ["Removed the background"] });
    expect(doc().clips["background-clip"]).toBeUndefined();
    expect(doc().tracks.background).toBeUndefined();
  });
});

describe("from the third live eval", () => {
  it("animate_clip takes slide edges (from-right = moving left)", () => {
    const { project, out } = run("animate_clip", { clipId: "title", in: "from-right", out: "to-bottom" });
    expect(out.ok).toBe(true);
    expect(readAnimation(project.getState().doc.clips.title!).recipe).toMatchObject({ in: { preset: "in:left" }, out: { preset: "out:down" } });
  });

  it("animating a video clip's entrance at a cut suggests a transition", () => {
    const { out } = run("animate_clip", { clipId: "v3", in: "fade" });
    expect(out).toMatchObject({ ok: true, result: { note: expect.stringMatching(/add_transition/) } });
    expect(run("animate_clip", { clipId: "title", in: "fade" }).out).not.toMatchObject({ result: { note: expect.anything() } });
  });

  it("a failed batch lists what it didn't apply", () => {
    const { out } = run("apply_commands", { commands: [{ type: "clip/remove", payload: { clipId: "m1" } }, { type: "clip/add", payload: { kind: "audio", id: "m2", trackId: "music", assetId: "nope", startUs: 0, durationUs: S } }] });
    expect(out).toMatchObject({ ok: false, error: { notApplied: ["Removed clip m1"] } });
  });

  it("the summary lists cuts, track locks and caption boxes", () => {
    const project = fixture();
    project.dispatch({ type: "track/set-property", payload: { trackId: "video", locked: true } });
    const text = describeForAssistant(project.toJSON());
    expect(text).toMatch(/cuts \(.*\): 10s v1→v2, 15s v2→v3, 20s v3→v4/);
    expect(text).toMatch(/video = "Video" \(locked\)/);
  });
});

describe("from the fourth live eval", () => {
  const custom = () => {
    const project = fixture();
    for (const [prop, t, v] of [["opacity", 0, 0], ["opacity", 500_000, 1], ["scale", 0, 0.8], ["scale", 500_000, 1]] as const)
      project.dispatch({ type: "keyframe/set", payload: { clipId: "title", property: prop, timeUs: t, value: v } });
    return project;
  };

  it("hand-made keyframes aren't read as presets, and animate_clip won't overwrite them", () => {
    const project = custom();
    expect(describeForAssistant(project.toJSON())).toMatch(/title: .*custom keyframes \(not presets\): opacity 0.5s 0 → 1s 1; scale 0.5s 0.8 → 1s 1/);
    const out = run("animate_clip", { clipId: "title", in: "none" }, project).out;
    expect(JSON.stringify(out)).toMatch(/keyframe\/clear/);
    expect(project.getState().doc.clips.title!.animations!.scale).toHaveLength(2);
    expect(run("animate_clip", { clipId: "title", in: "fade", reset: true }, project).out.ok).toBe(true);
  });

  it("preset animations still read as presets", () => {
    const { project } = run("animate_clip", { clipId: "title", in: "pop", loop: "pulse", out: "fade" });
    expect(describeForAssistant(project.toJSON())).toMatch(/title: .*animation Pop in · Pulse · Fade out/);
  });

  it("the selection is stated as a scope rule in the system prompt", async () => {
    const project = fixture();
    project.setSelection(["v2"]);
    const model = scriptedChatModel(["ok"]);
    await createAssistant({ model }).run(project, "make this vintage");
    expect(model.requests[0]!.messages[0]!.content).toMatch(/Selected: v2 \(video, 10–15s\)\. .*mean ONLY v2/);
  });
});
