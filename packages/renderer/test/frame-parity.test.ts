/**
 * Frame parity on a long NTSC timeline: after save/reload, seeking the
 * preview to a frame, stepping the clock frame by frame, and exporting all
 * agree on frame count, frame times and which clip each frame shows.
 */
import { describe, expect, it } from "vitest";
import {
  createProject,
  frameCount,
  frameToUs,
  projectFrameRate,
  usToFrame,
  type Asset,
  type ImageClip,
} from "@miraiclip/core";
import { StepClock } from "../src/clock.js";
import { Compositor } from "../src/compositor/compositor.js";
import { exportComposition, exportFrameWindow } from "../src/export/exporter.js";
import type { ExportSink } from "../src/export/types.js";
import { FakeBackend, FakeNode } from "./scene-fakes.js";

const HOUR_US = 3_600_000_000;

/** Records which clip each node draws, so a render can be read back as "the visible clip". */
class RecordingBackend extends FakeBackend {
  byClip = new Map<string, FakeNode>();
  override createImage(clip: ImageClip, asset: Asset | undefined): FakeNode {
    const node = super.createImage(clip, asset) as FakeNode;
    this.byClip.set(clip.id, node);
    return node;
  }
}

class RecordingSink implements ExportSink {
  frames: { timestampUs: number; durationUs: number }[] = [];
  async addVideoFrame(timestampUs: number, durationUs: number): Promise<void> {
    this.frames.push({ timestampUs, durationUs });
  }
  async finalize(): Promise<Uint8Array> {
    return new Uint8Array();
  }
  async cancel(): Promise<void> {}
}

/** An hour at 29.97, clips back to back with every cut on a frame boundary. */
function longNtscProject() {
  const project = createProject({ width: 640, height: 360, fps: 29.97 });
  const rate = projectFrameRate(project.getState().doc.settings);
  const total = frameCount(HOUR_US, rate);
  const lengths = [1, 2, 3, 7, 1001, 299, 30, 29]; // every phase of the 3-frame / 100,100 µs cycle
  const cuts = [0];
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/img.png" } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    for (let i = 0; cuts.at(-1)! < total; i++) {
      const from = cuts.at(-1)!;
      const to = Math.min(total, from + lengths[i % lengths.length]!);
      const startUs = frameToUs(from, rate);
      project.dispatch({
        type: "clip/add",
        payload: { kind: "image", id: `c${i}`, trackId: "v1", assetId: "img", startUs, durationUs: frameToUs(to, rate) - startUs },
      });
      cuts.push(to);
    }
  });
  // Frame n belongs to clip c{k} where cuts[k] <= n < cuts[k+1].
  const owner = new Array<string>(total);
  for (let k = 0; k + 1 < cuts.length; k++) {
    for (let n = cuts[k]!; n < cuts[k + 1]!; n++) owner[n] = `c${k}`;
  }
  return { project, total, owner };
}

describe("frame parity on a long NTSC timeline", () => {
  it("preview seeks, clock steps and export agree after save/reload", async () => {
    const built = longNtscProject();
    const project = createProject(JSON.parse(JSON.stringify(built.project.toJSON())));
    const { doc } = project.getState();
    const rate = projectFrameRate(doc.settings);
    expect(rate).toEqual({ num: 30000, den: 1001 });

    const backend = new RecordingBackend();
    const compositor = new Compositor(project, backend);
    // Nodes are mounted around the render time (compositor residency), so
    // read the live set — a snapshot taken at construction goes stale.
    const visibleClip = (): string => {
      const shown = [...backend.byClip].filter(([, node]) => !node.destroyed && node.visible);
      return shown.length === 1 ? shown[0]![0] : `(${shown.length} visible)`;
    };
    const endUs = Math.max(...Object.values(doc.clips).map((c) => c.startUs + c.durationUs));
    const total = frameCount(endUs, rate);
    expect(total).toBe(built.total); // 107,893

    // Export: the real frame walk, rendering into the same compositor.
    const sink = new RecordingSink();
    const exported: string[] = [];
    await exportComposition({
      startUs: 0,
      endUs,
      fps: doc.settings.fps, // the stored number (30000/1001 as a float) — read exactly
      sink,
      renderFrame: async (timeUs) => {
        compositor.renderAt(timeUs);
        exported.push(visibleClip());
      },
    });
    expect(sink.frames).toHaveLength(total);
    expect(exported).toHaveLength(total);

    const clock = new StepClock();
    let bad = 0;
    const firstBad: string[] = [];
    const fail = (what: string) => {
      bad++;
      if (firstBad.length < 5) firstBad.push(what);
    };
    for (let n = 0; n < total; n++) {
      const startUs = frameToUs(n, rate);
      // Seek: the frame's start maps back to the frame.
      if (usToFrame(startUs, rate) !== n) fail(`seek ${n}`);
      // Clock: stepping from 0 lands on every frame start, with no drift.
      if (n > 0 && clock.step(rate) !== startUs) fail(`step ${n}`);
      // Preview: a paused seek to the frame shows the frame's own clip.
      compositor.renderAt(startUs);
      if (visibleClip() !== built.owner[n]) fail(`preview ${n}: ${visibleClip()} ≠ ${built.owner[n]}`);
      // Export: same clip, frame timestamps from the index, sample inside the frame.
      if (exported[n] !== built.owner[n]) fail(`export ${n}: ${exported[n]} ≠ ${built.owner[n]}`);
      const frame = sink.frames[n]!;
      const window = exportFrameWindow(n, 0, endUs, rate);
      if (frame.timestampUs !== startUs) fail(`timestamp ${n}: ${frame.timestampUs} ≠ ${startUs}`);
      if (frame.timestampUs + frame.durationUs !== Math.min(frameToUs(n + 1, rate), endUs)) fail(`duration ${n}`);
      if (usToFrame(window.sampleUs, rate) !== n) fail(`sample ${n}`);
    }
    expect(firstBad).toEqual([]);
    expect(bad).toBe(0);

    // Covered exactly: no gap, no overlap, ends at the timeline's end.
    const last = sink.frames.at(-1)!;
    expect(last.timestampUs + last.durationUs).toBe(endUs);
    expect(sink.frames.reduce((sum, f) => sum + f.durationUs, 0)).toBe(endUs);
    compositor.destroy();
  }, 60_000);

  it("an exact { num, den } rate and its decimal export the same frames", async () => {
    const run = async (fps: number | { num: number; den: number }) => {
      const sink = new RecordingSink();
      const rendered: number[] = [];
      await exportComposition({
        startUs: 0,
        endUs: 60_000_000,
        fps,
        sink,
        renderFrame: async (t) => {
          rendered.push(t);
        },
      });
      return { frames: sink.frames, rendered };
    };
    const exact = await run({ num: 30000, den: 1001 });
    expect(exact.frames).toHaveLength(1799); // ⌈60 s · 29.97⌉
    expect(await run(29.97)).toEqual(exact);
    expect(await run(30000 / 1001)).toEqual(exact);
  });
});
