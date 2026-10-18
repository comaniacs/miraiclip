import { describe, expect, it } from "vitest";
import { isRecordingFile, packRecording, unpackRecording, type CaptureSession } from "../src/index.js";

const session: CaptureSession = {
  format: 1,
  startedAt: "2026-10-17T10:30:00.000Z",
  durationUs: 3_000_000,
  viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
  media: { screen: { mimeType: "video/webm", width: 1280, height: 720, durationUs: 3_000_000 }, camera: { mimeType: "video/webm", width: 640, height: 480, durationUs: 3_000_000 } },
  events: [
    { tUs: 0, type: "navigate", url: "https://app.example.com/" },
    { tUs: 1_000_000, type: "marker", label: "Step 1", data: { kind: "step" } },
  ],
};
const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff);

describe("packRecording / unpackRecording", () => {
  it("round-trips the screen, camera and session through one file", async () => {
    const screen = new Blob([bytes(200_000, 1)], { type: "video/webm" });
    const camera = new Blob([bytes(50_000, 7)], { type: "video/webm" });
    const packed = await packRecording({ screen, camera, session });
    const out = await unpackRecording(packed);
    expect(new Uint8Array(await out.screen.arrayBuffer())).toEqual(bytes(200_000, 1));
    expect(new Uint8Array(await out.camera!.arrayBuffer())).toEqual(bytes(50_000, 7));
    expect(out.screen.type).toBe("video/webm");
    expect(out.session.events.map((e) => e.type)).toEqual(["navigate", "marker"]);
  });

  it("leaves the camera out when there isn't one", async () => {
    const out = await unpackRecording(await packRecording({ screen: new Blob([bytes(10, 2)], { type: "video/webm" }), session }));
    expect(out.camera).toBeUndefined();
  });

  it("rejects files that aren't recordings", async () => {
    await expect(unpackRecording(new Blob(["hello"]))).rejects.toThrow(/not a Miraiclip recording/);
  });

  it("recognises recording files by name", () => {
    expect(isRecordingFile({ name: "recording-2026.mcrec" })).toBe(true);
    expect(isRecordingFile({ name: "clip.webm" })).toBe(false);
  });
});
