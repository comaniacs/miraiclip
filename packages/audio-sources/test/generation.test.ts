import { describe, expect, it } from "vitest";
import { createProject, type AudioClip } from "@miraiclip/core";
import {
  audioToolDefinitions,
  createAudioLibrary,
  createGeneratorHandler,
  defineGenerator,
  elevenLabsGenerator,
  remoteGenerators,
  runAudioTool,
  startGeneration,
  toneGenerator,
  type FetchLike,
  type GenerationJob,
} from "../src/index.js";

const project = () => createProject({ width: 1280, height: 720, fps: 30 });

/** Records ElevenLabs-style calls and answers with audio bytes (or JSON for voices). */
function fakeElevenLabs(opts: { voices?: { voice_id: string; name: string }[]; fail?: { status: number; detail: unknown } } = {}) {
  const calls: { url: string; init?: RequestInit; body?: Record<string, unknown> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (opts.fail) return new Response(JSON.stringify({ detail: opts.fail.detail }), { status: opts.fail.status });
    if (url.includes("/v2/voices")) return Response.json({ voices: opts.voices ?? [{ voice_id: "v-1", name: "Aria", labels: { language: "en" } }] });
    return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "audio/mpeg", "song-id": "song-9", "request-id": "req-7" } });
  };
  return { fetch, calls };
}

describe("defineGenerator", () => {
  it("rejects malformed adapters early", () => {
    const base = { id: "x", label: "X", kinds: ["sfx" as const], terms: { license: { id: "CC0-1.0", commercial: true, attributionRequired: false } }, generate: async () => ({ data: new Uint8Array(), mimeType: "audio/wav" }) };
    expect(() => defineGenerator({ ...base, id: "bad id" })).toThrow(/alphanumeric/);
    expect(() => defineGenerator({ ...base, kinds: [] })).toThrow(/no kinds/);
    expect(() => defineGenerator({ ...base, models: [{ id: "m", label: "M", kinds: ["voice"] }] })).toThrow(/unsupported kinds/);
  });
});

describe("startGeneration", () => {
  it("runs a job, reports progress, stores the file and records provenance", async () => {
    const stored: { name: string; type: string; size: number }[] = [];
    const job = startGeneration(toneGenerator({ latencyMs: 20 }), { kind: "sfx", prompt: "laser zap", durationS: 0.5 }, {
      storeFile: async (file, name) => (stored.push({ name, type: file.type, size: file.size }), "https://cdn.me/zap.wav"),
    });
    const seen: string[] = [];
    job.onChange((j) => seen.push(`${j.status}:${j.progress ?? "-"}`));
    expect(job.status).toBe("running");
    const { resolved, file } = await job.result;
    expect(job.status).toBe("done");
    expect(seen.at(-1)).toBe("done:1");
    expect(seen.some((s) => s.startsWith("running:0.5"))).toBe(true);
    expect(stored[0]).toMatchObject({ name: "laser zap.wav", type: "audio/wav" });
    expect(file!.size).toBe(44 + 0.5 * 22_050 * 2);
    expect(resolved).toMatchObject({
      src: "https://cdn.me/zap.wav",
      name: "laser zap",
      kind: "sfx",
      durationUs: 500_000,
      license: { id: "CC0-1.0" },
      source: { provider: "tone" },
    });
  });

  it("validates against kinds and limits", async () => {
    const g = toneGenerator();
    await expect(startGeneration(g, { kind: "sfx", prompt: "  " }).result).rejects.toThrow(/prompt is required/);
    await expect(startGeneration(g, { kind: "sfx", prompt: "boom", durationS: 99 }).result).rejects.toThrow(/at most 30/);
    const sfxOnly = defineGenerator({ ...g, id: "sfx-only", kinds: ["sfx"], models: [] });
    await expect(startGeneration(sfxOnly, { kind: "voice", text: "hi" }).result).rejects.toThrow(/can't generate voice/);
  });

  it("cancels", async () => {
    const job = startGeneration(toneGenerator({ latencyMs: 200 }), { kind: "music", prompt: "calm" });
    job.cancel();
    await expect(job.result).rejects.toThrow();
    expect(job.status).toBe("canceled");
  });
});

describe("elevenLabsGenerator", () => {
  it("sound effects: endpoint, body, auth, format", async () => {
    const { fetch, calls } = fakeElevenLabs();
    const g = elevenLabsGenerator({ apiKey: "sk", fetch });
    const out = await g.generate({ kind: "sfx", prompt: "door creak", durationS: 2 }, { params: { prompt_influence: 0.6 } });
    expect(calls[0]!.url).toBe("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128");
    expect((calls[0]!.init!.headers as Record<string, string>)["xi-api-key"]).toBe("sk");
    expect(calls[0]!.body).toEqual({ text: "door creak", model_id: "eleven_text_to_sound_v2", duration_seconds: 2, prompt_influence: 0.6 });
    expect(out).toMatchObject({ mimeType: "audio/mpeg", durationUs: 2_000_000, model: "eleven_text_to_sound_v2" });
  });

  it("music: prompt, length, instrumental, song id", async () => {
    const { fetch, calls } = fakeElevenLabs();
    const out = await elevenLabsGenerator({ fetch }).generate({ kind: "music", prompt: "lofi beat", durationS: 30, instrumental: true }, { model: "music_v1" });
    expect(calls[0]!.url).toContain("/v1/music?");
    expect(calls[0]!.body).toEqual({ prompt: "lofi beat", model_id: "music_v1", music_length_ms: 30_000, force_instrumental: true });
    expect(out.id).toBe("song-9");
  });

  it("voice: falls back to the first voice, maps voice settings and language", async () => {
    const { fetch, calls } = fakeElevenLabs();
    const g = elevenLabsGenerator({ fetch });
    await g.generate({ kind: "voice", text: "Hello there", language: "en-US" }, { seed: 7, params: { stability: 0.4, speed: 1.1 } });
    expect(calls[0]!.url).toContain("/v2/voices");
    expect(calls[1]!.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v-1?output_format=mp3_44100_128");
    expect(calls[1]!.body).toEqual({ text: "Hello there", model_id: "eleven_multilingual_v2", language_code: "en", seed: 7, voice_settings: { stability: 0.4, speed: 1.1 } });
    expect(await g.voices!()).toEqual([{ id: "v-1", name: "Aria", language: "en" }]);
  });

  it("surfaces vendor errors with status, and records plan terms", async () => {
    const { fetch } = fakeElevenLabs({ fail: { status: 401, detail: { status: "invalid_api_key", message: "Invalid API key" } } });
    await expect(elevenLabsGenerator({ fetch }).generate({ kind: "sfx", prompt: "x" }, {})).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Invalid API key") });
    expect(elevenLabsGenerator().terms.license).toMatchObject({ commercial: false, attributionRequired: true });
    expect(elevenLabsGenerator({ plan: "paid" }).terms.license).toMatchObject({ commercial: true });
  });
});

describe("any vendor plugs in", () => {
  it("a hypothetical text-to-speech API is a few lines", async () => {
    const calls: string[] = [];
    const acmeTts = defineGenerator({
      id: "acme",
      label: "Acme TTS",
      kinds: ["voice"],
      terms: { license: { id: "Acme-Commercial", commercial: true, attributionRequired: false } },
      async generate(request, opts) {
        if (request.kind !== "voice") throw new Error("voice only");
        calls.push(JSON.stringify({ input: request.text, voice: request.voice ?? "alloy", model: opts.model ?? "acme-1", ...opts.params }));
        return { data: new Uint8Array([9, 9]), mimeType: "audio/mpeg", durationUs: 1_000_000 };
      },
    });
    const lib = createAudioLibrary([], { generators: [acmeTts] });
    const { resolved } = await lib.generate("acme", { kind: "voice", text: "Hi", voice: "nova" }, { params: { speed: 1.2 }, storeFile: async () => "/u/hi.mp3" }).result;
    expect(calls).toEqual(['{"input":"Hi","voice":"nova","model":"acme-1","speed":1.2}']);
    expect(resolved).toMatchObject({ src: "/u/hi.mp3", source: { provider: "acme" }, license: { id: "Acme-Commercial" } });
  });
});

describe("server handler + remote generators", () => {
  it("round-trips info, voices and generation; keeps keys on the server", async () => {
    const el = fakeElevenLabs();
    const handle = createGeneratorHandler([elevenLabsGenerator({ apiKey: "server-secret", fetch: el.fetch }), toneGenerator()], { basePath: "/api/generate" });
    // The browser's fetch, routed into the handler.
    const browserFetch: FetchLike = async (url, init) => (await handle(new Request(new URL(url, "http://app.local"), init))) ?? new Response("nope", { status: 404 });

    const gens = await remoteGenerators("/api/generate", { fetch: browserFetch });
    expect(gens.map((g) => g.id)).toEqual(["elevenlabs", "tone"]);
    expect(gens[0]!.paramsSchema?.sfx?.properties.prompt_influence).toBeDefined();
    expect(typeof gens[0]!.voices).toBe("function");
    expect(await gens[0]!.voices!()).toEqual([{ id: "v-1", name: "Aria", language: "en" }]);

    const lib = createAudioLibrary([], { generators: gens });
    const { resolved, file } = await lib.generate("elevenlabs", { kind: "sfx", prompt: "rain", durationS: 3 }, { storeFile: async () => "/uploads/rain.mp3" }).result;
    expect(file!.size).toBe(4);
    expect(resolved).toMatchObject({ src: "/uploads/rain.mp3", durationUs: 3_000_000, license: { id: "ElevenLabs-Free" }, attribution: "Audio generated with ElevenLabs (elevenlabs.io)" });
    // The key was only ever sent by the server.
    expect((el.calls.at(-1)!.init!.headers as Record<string, string>)["xi-api-key"]).toBe("server-secret");

    // Validation happens server-side too.
    const bad = await browserFetch("/api/generate/tone/generate", { method: "POST", body: JSON.stringify({ request: { kind: "sfx", prompt: "" } }) });
    expect(bad.status).toBe(400);
    expect(await handle(new Request("http://app.local/other"))).toBeNull();
  });
});

describe("AI tools with generators", () => {
  it("generate_audio adds the result as one clip; list_voices lists", async () => {
    const lib = createAudioLibrary([], { generators: [toneGenerator()] });
    const names = (audioToolDefinitions(lib) as { name: string }[]).map((d) => d.name);
    expect(names).toEqual(["search_audio", "add_audio", "generate_audio", "list_voices"]);

    const p = project();
    const jobs: GenerationJob[] = [];
    const out = await runAudioTool(
      "generate_audio",
      { kind: "music", prompt: "happy ukulele", durationSeconds: 4, atSeconds: 1, volume: 0.4, fadeOutSeconds: 1 },
      { library: lib, project: p, storeFile: async () => "/uploads/uke.wav", onGeneration: (j) => jobs.push(j) },
    );
    expect(out).toMatchObject({ ok: true, result: { title: "happy ukulele", kind: "music", durationS: 4, license: "CC0-1.0" } });
    expect(jobs).toHaveLength(1);
    const clip = Object.values(p.getState().doc.clips)[0] as AudioClip;
    expect(clip).toMatchObject({ startUs: 1_000_000, durationUs: 4_000_000, volume: 0.4, fadeOutUs: 1_000_000 });
    expect(p.getState().doc.assets[clip.assetId]).toMatchObject({ src: "/uploads/uke.wav", source: { provider: "tone" } });

    expect(await runAudioTool("generate_audio", { kind: "voice" }, { library: lib, project: p })).toMatchObject({ ok: false, error: expect.stringContaining("text") });
    expect(await runAudioTool("list_voices", { query: "high" }, { library: lib, project: p })).toEqual({ ok: true, result: { generator: "tone", voices: [{ id: "high", name: "High tone" }] } });
  });
});
