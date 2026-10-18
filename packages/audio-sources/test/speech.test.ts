import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { audioDurationUs, mp3DurationUs, openAiSpeechGenerator, wavDurationUs } from "../src/index.js";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasFfmpeg)("audio durations from bytes", () => {
  const dir = hasFfmpeg ? mkdtempSync(path.join(tmpdir(), "mc-dur-")) : "";
  const make = (name: string, args: string[]) => {
    const file = path.join(dir, name);
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2.5", ...args, "-y", file]);
    return new Uint8Array(readFileSync(file));
  };

  it("reads WAV exactly", () => {
    expect(wavDurationUs(make("a.wav", ["-ar", "24000"]))).toBe(2_500_000);
  });

  it("reads MP3 like ffprobe does, CBR and VBR, with an ID3 tag", () => {
    for (const args of [["-b:a", "128k"], ["-q:a", "4"], ["-ar", "24000", "-b:a", "48k"]]) {
      const name = `a${args.join("")}.mp3`;
      const us = mp3DurationUs(make(name, ["-c:a", "libmp3lame", ...args]));
      // ffprobe's reading (the encoder pads the end a little past the 2.5 s of input).
      const probed = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dir, name)]).toString()) * 1e6;
      expect(Math.abs(us! - probed), args.join(" ")).toBeLessThan(30_000);
      expect(Math.abs(us! - 2_500_000), args.join(" ")).toBeLessThan(100_000);
    }
  });

  it("sniffs the format and gives up on unknown ones", () => {
    expect(audioDurationUs(make("b.wav", []))).toBe(2_500_000);
    expect(audioDurationUs(new Uint8Array([1, 2, 3, 4]), "audio/ogg")).toBeUndefined();
  });
});

describe("openAiSpeechGenerator", () => {
  it("posts text, voice and delivery direction; reports the file's duration", async () => {
    // 1 s of 16-bit mono silence at 24 kHz, as a streamed WAV (size fields left at 0xFFFFFFFF).
    const wav = new Uint8Array(44 + 48_000);
    const v = new DataView(wav.buffer);
    wav.set([82, 73, 70, 70], 0);
    v.setUint32(4, 0xffffffff, true);
    wav.set([87, 65, 86, 69, 102, 109, 116, 32], 8);
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 24000, true);
    v.setUint32(28, 48000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    wav.set([100, 97, 116, 97], 36);
    v.setUint32(40, 0xffffffff, true);
    let body: Record<string, unknown> = {};
    const gen = openAiSpeechGenerator({
      apiKey: "sk",
      fetch: async (_url, init) => {
        body = JSON.parse(init!.body as string);
        return new Response(wav, { headers: { "content-type": "audio/wav" } });
      },
    });
    const out = await gen.generate({ kind: "voice", text: "Click Save.", voice: "nova", style: "calm and warm" }, { format: "wav" });
    expect(body).toMatchObject({ model: "gpt-4o-mini-tts", input: "Click Save.", voice: "nova", response_format: "wav", instructions: "calm and warm" });
    expect(out).toMatchObject({ mimeType: "audio/wav", durationUs: 1_000_000, model: "gpt-4o-mini-tts" });
    expect((await gen.voices!()).map((x) => x.id)).toContain("alloy");
    await expect(gen.generate({ kind: "sfx", prompt: "boom" }, {})).rejects.toThrow(/sfx/);
  });
});
