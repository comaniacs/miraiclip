import { describe, expect, it } from "vitest";
import { applyCommands, createProject, isVideoClip } from "@miraiclip/core";
import { eventsOfType, parseCaptureSession, sessionCommands, toVideoFraction, type CaptureSession } from "../src/index.js";

const session: CaptureSession = {
  format: 1,
  startedAt: "2026-10-17T00:00:00.000Z",
  durationUs: 12_000_000,
  viewport: { width: 1280, height: 720, devicePixelRatio: 2 },
  viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
  media: {
    screen: { mimeType: "video/webm", width: 2560, height: 1440, durationUs: 12_000_000 },
    microphone: { mimeType: "video/webm", durationUs: 12_000_000 },
    camera: { mimeType: "video/webm", width: 1280, height: 720, durationUs: 12_000_000 },
  },
  events: [
    { tUs: 4_000_000, type: "marker", label: "Save the file" },
    { tUs: 1_000_000, type: "click", x: 640, y: 360, button: 0 },
    { tUs: 0, type: "navigate", url: "https://app.example.com/" },
    { tUs: 8_000_000, type: "marker", label: "Share it", data: { kind: "step" } },
  ],
};

describe("parseCaptureSession", () => {
  it("round-trips through JSON, sorts events and drops unknown types", () => {
    const raw = JSON.parse(JSON.stringify(session));
    raw.events.push({ tUs: 2, type: "telepathy" }, { type: "click" });
    const parsed = parseCaptureSession(JSON.stringify(raw));
    expect(parsed.events.map((e) => e.tUs)).toEqual([0, 1_000_000, 4_000_000, 8_000_000]);
    expect(parsed.viewport.devicePixelRatio).toBe(2);
  });

  it("rejects things that aren't capture sessions", () => {
    expect(() => parseCaptureSession({})).toThrow(/format/);
    expect(() => parseCaptureSession({ format: 1, durationUs: 1 })).toThrow(/viewport/);
    expect(() => parseCaptureSession({ format: 1, viewport: { width: 1, height: 1 } })).toThrow(/durationUs/);
  });
});

describe("sessionCommands", () => {
  it("builds a valid project: screen track, camera picture-in-picture, one marker per marker event", () => {
    const p = createProject({ width: 1920, height: 1080, fps: 30 });
    const result = applyCommands(p, sessionCommands(session, { screenSrc: "screen.webm", cameraSrc: "camera.webm" }));
    expect(result.ok, JSON.stringify(!result.ok && result.error)).toBe(true);
    const doc = p.getState().doc;
    expect(doc.settings).toMatchObject({ width: 2560, height: 1440, fps: 30 });
    expect(doc.trackOrder).toEqual(["screen", "camera"]);
    expect(doc.assets["screen"]).toMatchObject({ kind: "video", src: "screen.webm", source: { provider: "recording" } });
    const cam = doc.clips["camera"]!;
    expect(isVideoClip(cam) && cam.volume).toBe(0);
    // Bottom-right corner, 22% of the frame wide.
    expect(cam.transform.x).toBeGreaterThan(0.8);
    expect(cam.transform.y).toBeGreaterThan(0.8);
    expect(cam.transform.scale).toBeCloseTo(0.22, 5);
    expect(Object.values(doc.markers ?? {}).map((m) => [m.timeUs, m.label])).toEqual([
      [4_000_000, "Save the file"],
      [8_000_000, "Share it"],
    ]);
  });

  it("without file locations it only adds settings and markers", () => {
    const commands = sessionCommands(session, { settings: false });
    expect(commands.map((c) => c.type)).toEqual(["marker/add", "marker/add"]);
  });
});

describe("helpers", () => {
  it("toVideoFraction maps viewport pixels into the video frame box", () => {
    expect(toVideoFraction(session, 640, 360)).toEqual({ x: 0.5, y: 0.5 });
    const windowed = { ...session, viewportInVideo: { x: 0.1, y: 0.2, width: 0.8, height: 0.7 } };
    const f = toVideoFraction(windowed, 0, 720);
    expect(f.x).toBeCloseTo(0.1, 9);
    expect(f.y).toBeCloseTo(0.9, 9);
  });

  it("eventsOfType filters and orders", () => {
    expect(eventsOfType(session, "marker", "click").map((e) => e.type)).toEqual(["click", "marker", "marker"]);
  });
});

describe("placeCamera", () => {
  it("keeps the visible part's gap to the corner, also when cropped to a square", async () => {
    const { placeCamera } = await import("../src/index.js");
    const frame = { width: 1920, height: 1080 };
    const camera = { width: 1280, height: 720 };
    for (const square of [0, 1]) {
      const p = placeCamera({ frame, camera, corner: "bottom-right", widthFrac: 0.2, square });
      const fit = Math.min(1920 / 1280, 1080 / 720);
      const visW = square ? 720 : 1280;
      const shownW = (visW * fit * p.scale) / 1920;
      expect(shownW).toBeCloseTo(0.2, 4); // the width asked for is what shows
      expect(p.x + shownW / 2).toBeCloseTo(0.97, 4); // right edge at the margin
    }
  });
});
