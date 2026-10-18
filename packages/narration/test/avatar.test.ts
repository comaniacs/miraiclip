import { describe, expect, it } from "vitest";
import { applyCommands, createProject } from "@miraiclip/core";
import { avatarCommands, type AvatarProvider } from "../src/index.js";

describe("avatar contract", () => {
  it("a provider's video lands as a keyed picture-in-picture", async () => {
    const provider: AvatarProvider = {
      id: "fake",
      label: "Fake",
      avatars: async () => [{ id: "ava", name: "Ava" }],
      render: async (req) => ({ url: `https://cdn.test/${req.avatarId}.mp4`, mimeType: "video/mp4", durationUs: 5_000_000, width: 1280, height: 720, background: "green" }),
    };
    const video = await provider.render({ avatarId: "ava", script: { text: "Hi!" } });
    const p = createProject({ width: 1920, height: 1080, fps: 30 });
    const r = applyCommands(p, avatarCommands(video, { startUs: 1_000_000, composition: { width: 1920, height: 1080 } }));
    expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
    const clip = p.getState().doc.clips["avatar"]!;
    expect(clip.transform.scale).toBeCloseTo(0.3, 5);
    expect(clip.transform.x).toBeGreaterThan(0.8);
    expect(clip.effects?.[0]?.kind).toBe("chromaKey");
    expect(p.getState().doc.assets["avatar"]!.src).toBe("https://cdn.test/ava.mp4");
  });
});
