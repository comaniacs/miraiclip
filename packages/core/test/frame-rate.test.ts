import { describe, expect, it } from "vitest";
import {
  CommandRejectedError,
  CommandValidationError,
  createProject,
  describeProject,
  formatFrameRate,
  frameCount,
  frameToUs,
  projectFrameRate,
  snapToFrame,
  toFrameRate,
  usToFrame,
  usToTimecode,
  type FrameRate,
} from "../src/index.js";

const NTSC: FrameRate = { num: 30000, den: 1001 };
const HOUR_US = 3_600_000_000;

describe("toFrameRate", () => {
  it("reads decimal NTSC rates as exact /1001 ratios", () => {
    expect(toFrameRate(29.97)).toEqual({ num: 30000, den: 1001 });
    expect(toFrameRate(30000 / 1001)).toEqual({ num: 30000, den: 1001 });
    expect(toFrameRate(23.976)).toEqual({ num: 24000, den: 1001 });
    expect(toFrameRate(23.98)).toEqual({ num: 24000, den: 1001 });
    expect(toFrameRate(59.94)).toEqual({ num: 60000, den: 1001 });
    expect(toFrameRate(119.88)).toEqual({ num: 120000, den: 1001 });
  });

  it("keeps whole rates whole, reads other decimals to 1/1000 and reduces ratios", () => {
    expect(toFrameRate(30)).toEqual({ num: 30, den: 1 });
    expect(toFrameRate(25)).toEqual({ num: 25, den: 1 });
    expect(toFrameRate(12.5)).toEqual({ num: 25, den: 2 });
    expect(toFrameRate({ num: 60, den: 2 })).toEqual({ num: 30, den: 1 });
  });

  it("rejects invalid rates", () => {
    expect(() => toFrameRate(0)).toThrow(RangeError);
    expect(() => toFrameRate(Number.NaN)).toThrow(RangeError);
    expect(() => toFrameRate({ num: 30, den: 0 })).toThrow(RangeError);
    expect(() => toFrameRate({ num: 29.97, den: 1 })).toThrow(RangeError);
  });

  it("formats for display", () => {
    expect(formatFrameRate(NTSC)).toBe("29.97");
    expect(formatFrameRate({ num: 24000, den: 1001 })).toBe("23.976");
    expect(formatFrameRate(30)).toBe("30");
  });
});

describe("frame mapping", () => {
  const rates: Array<[string, number | FrameRate]> = [
    ["23.976", { num: 24000, den: 1001 }],
    ["24", 24],
    ["25", 25],
    ["29.97", NTSC],
    ["29.97 as a decimal", 29.97],
    ["30", 30],
    ["50", 50],
    ["59.94", { num: 60000, den: 1001 }],
    ["60", 60],
  ];

  it.each(rates)("round-trips every frame of an hour at %s", (_, rate) => {
    const frames = frameCount(HOUR_US, rate);
    let prev = -1;
    let bad = 0;
    for (let n = 0; n <= frames; n++) {
      const us = frameToUs(n, rate);
      if (usToFrame(us, rate) !== n) bad++; // the frame's first µs is in the frame
      if (n > 0 && usToFrame(us - 1, rate) !== n - 1) bad++; // the µs before it is not
      if (us <= prev) bad++;
      if (snapToFrame(us, rate) !== us) bad++;
      prev = us;
    }
    expect(bad).toBe(0);
  });

  it("derives each timestamp from its index — no drift at 29.97", () => {
    // 107,892 frames at 30000/1001 is exactly 3,599,996,400 µs.
    expect(frameToUs(107_892, NTSC)).toBe(3_599_996_400);
    // Adding a rounded frame (33,367 µs) 107,892 times would land 36 ms late.
    expect(107_892 * Math.round(1_000_000 / (30000 / 1001)) - frameToUs(107_892, NTSC)).toBe(35_964);
    expect(frameCount(HOUR_US, NTSC)).toBe(107_893);
    expect(frameCount(HOUR_US, 30)).toBe(108_000);
    expect(frameCount(0, NTSC)).toBe(0);
    expect(frameCount(33_334, 30)).toBe(1); // frame 1 starts at 33,334
    expect(frameCount(33_335, 30)).toBe(2);
  });

  it("uses the first whole µs of a frame as its start", () => {
    expect(frameToUs(1, 30)).toBe(33_334); // frame 1 = [33,333.3…, 66,666.6…) µs
    expect(usToFrame(33_333, 30)).toBe(0);
    expect(usToFrame(33_334, 30)).toBe(1);
    expect(frameToUs(1, NTSC)).toBe(33_367);
    expect(frameToUs(3, NTSC)).toBe(100_100); // 3 frames is exactly 100,100 µs
  });

  it("stays exact past Number.MAX_SAFE_INTEGER intermediates", () => {
    const frame = 10_000_000_000; // ~3.9 years at 29.97: n·1e6·1001 ≈ 1e22
    const us = frameToUs(frame, NTSC);
    expect(usToFrame(us, NTSC)).toBe(frame);
    expect(usToFrame(us - 1, NTSC)).toBe(frame - 1);
  });

  it("snaps to the nearest frame start", () => {
    expect(snapToFrame(1_016_000, 30)).toBe(1_000_000);
    expect(snapToFrame(1_017_000, 30)).toBe(1_033_334);
    expect(snapToFrame(16_683, NTSC)).toBe(0);
    expect(snapToFrame(16_684, NTSC)).toBe(33_367);
  });
});

describe("timecode", () => {
  it("counts non-drop-frame at the nominal rate", () => {
    expect(usToTimecode(3_661_500_000, 30)).toBe("01:01:01:15");
    expect(usToTimecode(frameToUs(107_892, NTSC), NTSC)).toBe("00:59:56:12"); // 3.6 s behind the clock
  });

  it("formats SMPTE drop-frame at 29.97 and 59.94", () => {
    const df = (n: number, rate: FrameRate = NTSC) => usToTimecode(frameToUs(n, rate), rate, { dropFrame: true });
    expect(df(0)).toBe("00:00:00;00");
    expect(df(1799)).toBe("00:00:59;29");
    expect(df(1800)).toBe("00:01:00;02"); // ;00 and ;01 are skipped
    expect(df(17_981)).toBe("00:09:59;29");
    expect(df(17_982)).toBe("00:10:00;00"); // every tenth minute keeps them
    expect(df(107_892)).toBe("01:00:00;00"); // matches the clock
    expect(df(3600, { num: 60000, den: 1001 })).toBe("00:01:00;04");
    expect(df(215_784, { num: 60000, den: 1001 })).toBe("01:00:00;00");
  });

  it("ignores dropFrame at rates without it", () => {
    expect(usToTimecode(1_000_000, 30, { dropFrame: true })).toBe("00:00:01:00");
  });
});

describe("project frame rate", () => {
  it("stores a decimal NTSC fps exactly at creation", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 29.97 });
    const { settings } = project.getState().doc;
    expect(settings.frameRate).toEqual(NTSC);
    expect(settings.fps).toBe(30000 / 1001);
    expect(projectFrameRate(settings)).toEqual(NTSC);
    expect(describeProject(project.getState().doc)).toContain("@ 29.97fps");
  });

  it("keeps whole-rate documents unchanged", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    expect(project.getState().doc.settings).toEqual({ width: 1920, height: 1080, fps: 30 });
  });

  it("reads older documents that stored a decimal fps", () => {
    const doc = createProject({ width: 640, height: 360, fps: 30 }).toJSON();
    doc.settings.fps = 29.97; // as written before frameRate existed
    expect(projectFrameRate(createProject(doc).getState().doc.settings)).toEqual(NTSC);
  });

  it("project/set-settings keeps fps and frameRate in sync, with undo", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    project.dispatch({ type: "project/set-settings", payload: { fps: 59.94 } });
    expect(project.getState().doc.settings).toMatchObject({ fps: 60000 / 1001, frameRate: { num: 60000, den: 1001 } });

    project.dispatch({ type: "project/set-settings", payload: { frameRate: { num: 48000, den: 2002 } } });
    expect(project.getState().doc.settings).toMatchObject({ fps: 24000 / 1001, frameRate: { num: 24000, den: 1001 } });

    project.dispatch({ type: "project/set-settings", payload: { fps: 25 } });
    expect(project.getState().doc.settings).toEqual({ width: 1920, height: 1080, fps: 25 });

    project.undo();
    expect(project.getState().doc.settings.frameRate).toEqual({ num: 24000, den: 1001 });
    project.undo();
    project.undo();
    expect(project.getState().doc.settings).toEqual({ width: 1920, height: 1080, fps: 30 });
  });

  it("rejects a mismatched fps + frameRate and invalid ratios", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    expect(() =>
      project.dispatch({ type: "project/set-settings", payload: { fps: 30, frameRate: NTSC } }),
    ).toThrow(CommandRejectedError);
    expect(() =>
      project.dispatch({ type: "project/set-settings", payload: { frameRate: { num: 30000, den: 0 } } }),
    ).toThrow(CommandValidationError);
    expect(() =>
      project.dispatch({ type: "project/set-settings", payload: { frameRate: { num: 29.97, den: 1 } } }),
    ).toThrow(CommandValidationError);
    // Both, when they agree, is fine.
    project.dispatch({ type: "project/set-settings", payload: { fps: 29.97002997002997, frameRate: NTSC } });
    expect(project.getState().doc.settings.frameRate).toEqual(NTSC);
  });
});

describe("long NTSC timeline with frame-boundary cuts", () => {
  it("keeps every cut on its frame through save and reload", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 29.97 });
    const rate = projectFrameRate(project.getState().doc.settings);
    const total = frameCount(HOUR_US, rate);
    project.dispatch({
      type: "asset/add",
      payload: { id: "src", kind: "video", src: "/src.mp4", durationUs: 2 * HOUR_US },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });

    // Clips back to back for an hour, each cut on a frame boundary, with
    // lengths of 1–1001 frames so cuts land on every phase of the 3-frame
    // 100,100 µs cycle.
    const cuts: number[] = [0];
    const lengths = [1, 2, 3, 7, 1001, 299, 30, 29];
    project.transaction(() => {
      for (let i = 0; cuts[cuts.length - 1]! < total; i++) {
        const from = cuts[cuts.length - 1]!;
        const to = Math.min(total, from + lengths[i % lengths.length]!);
        const startUs = frameToUs(from, rate);
        project.dispatch({
          type: "clip/add",
          payload: {
            kind: "video",
            id: `c${i}`,
            trackId: "v1",
            assetId: "src",
            startUs,
            durationUs: frameToUs(to, rate) - startUs,
            trimStartUs: startUs,
          },
        });
        cuts.push(to);
      }
    });

    const reloaded = createProject(JSON.parse(JSON.stringify(project.toJSON())));
    const { doc } = reloaded.getState();
    const reRate = projectFrameRate(doc.settings);
    expect(reRate).toEqual(NTSC);

    const clips = Object.values(doc.clips)
      .filter((c) => c.trackId === "v1")
      .sort((a, b) => a.startUs - b.startUs);
    expect(clips).toHaveLength(cuts.length - 1);
    let bad = 0;
    let frames = 0;
    clips.forEach((clip, i) => {
      const endUs = clip.startUs + clip.durationUs;
      if (usToFrame(clip.startUs, reRate) !== cuts[i]) bad++;
      if (frameToUs(cuts[i]!, reRate) !== clip.startUs) bad++;
      if (snapToFrame(clip.startUs, reRate) !== clip.startUs) bad++;
      if (usToFrame(endUs - 1, reRate) !== cuts[i + 1]! - 1) bad++; // last frame is the clip's own
      if (i > 0 && clips[i - 1]!.startUs + clips[i - 1]!.durationUs !== clip.startUs) bad++; // no gaps or overlaps
      frames += frameCount(endUs, reRate) - frameCount(clip.startUs, reRate);
    });
    expect(bad).toBe(0);
    expect(frames).toBe(total);
    const last = clips[clips.length - 1]!;
    expect(frameCount(last.startUs + last.durationUs, reRate)).toBe(total);
  });
});
