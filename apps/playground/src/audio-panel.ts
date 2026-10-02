/**
 * Audio tab: exercises the audio stack end to end before publishing —
 * `@miraiclip/audio-sources` (library search, preview, importAudio, the LLM
 * tools), core provenance (credits, license report) and the renderer's fades
 * and waveform peaks. Everything lands through public APIs / commands.
 */
import { creditsFor, isAudioClip, licenseReport, type AudioClip, type Project } from "@miraiclip/core";
import {
  audioToolDefinitions,
  createAudioLibrary,
  remoteGenerators,
  type AudioGenerator,
  type GenerateRequest,
  type GenerationJob,
  type ParamsSchema,
  importAudio,
  openverseProvider,
  parseCreativeCommons,
  runAudioTool,
  staticProvider,
  type AudioItem,
  type AudioKind,
  type ResolvedAudio,
} from "@miraiclip/audio-sources";
import { clipFades, computeWaveformPeaks, openMediabunnyAudio, peaksForRange, type WaveformPeaks } from "@miraiclip/renderer";

const CC0 = parseCreativeCommons("cc0");
const S = 1_000_000;

/** CC0 files synthesized for the template (scripts/make-demo-audio.py), in public/audio. */
const demo = staticProvider({
  id: "demo",
  label: "Demo (CC0)",
  notice: "Bundled CC0 files — offline.",
  entries: [
    { id: "sunny-steps", title: "Sunny Steps", kind: "music", durationUs: 27.2 * S, tags: ["upbeat", "acoustic"] },
    { id: "calm-drift", title: "Calm Drift", kind: "music", durationUs: 32 * S, tags: ["ambient", "calm"] },
    { id: "lofi-loop", title: "Lo-fi Loop", kind: "music", durationUs: 24.9 * S, tags: ["lofi", "chill"] },
    { id: "sfx-whoosh", title: "Whoosh", kind: "sfx", durationUs: 0.9 * S, tags: ["transition", "swoosh"] },
    { id: "sfx-pop", title: "Pop", kind: "sfx", durationUs: 0.18 * S, tags: ["ui", "bubble"] },
    { id: "sfx-ding", title: "Ding", kind: "sfx", durationUs: 2 * S, tags: ["bell", "chime"] },
    { id: "sfx-riser", title: "Riser", kind: "sfx", durationUs: 3 * S, tags: ["build", "transition"] },
  ].map((e) => ({ ...e, kind: e.kind as AudioKind, src: `/audio/${e.id}.webm`, license: CC0, creator: "Miraiclip" })),
});

// Openverse through the dev/preview proxy (vite.config.ts) — no CORS, no keys.
export const library = createAudioLibrary([demo, openverseProvider({ baseUrl: "/api/openverse" })]);

// Generators run on the dev server (vite.config.ts → /api/generate); the
// browser gets same-shaped proxies. Loaded once, then registered.
const generatorsReady = remoteGenerators("/api/generate")
  .then((gens) => gens.forEach((g) => library.addGenerator(g)))
  .catch((err) => console.warn("[audio] no generators:", err));

/** Remote files play through the same-origin /api/fetch proxy (Range + no CORS). */
async function store(resolved: ResolvedAudio): Promise<ResolvedAudio> {
  if (!/^https?:\/\//.test(resolved.src)) return resolved;
  return { ...resolved, src: `/api/fetch?url=${encodeURIComponent(resolved.src)}` };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

const fmt = (us?: number) => (us === undefined ? "" : `${(us / S).toFixed(1)}s`);

export function renderAudioPanel(body: HTMLElement, getProject: () => Project | undefined): () => void {
  const project = getProject();
  if (!project) {
    body.append(el("p", { className: "panel-note", textContent: "Load a video first." }));
    return () => {};
  }
  const preview = new Audio();
  const waveforms = new Map<string, Promise<WaveformPeaks | null>>();

  // ---------- library ----------
  const providerSel = el("select", { className: "au-provider" });
  for (const p of library.searchable()) providerSel.append(el("option", { value: p.id, textContent: p.label }));
  const kindSel = el("select", { className: "au-kind" });
  for (const [v, t] of [["", "All"], ["music", "Music"], ["sfx", "SFX"]]) kindSel.append(el("option", { value: v!, textContent: t! }));
  const query = el("input", { className: "au-query", type: "search", placeholder: "search (empty = all demo)" });
  const commercial = el("input", { type: "checkbox", className: "au-commercial" });
  const results = el("div", { className: "au-results" });
  const libStatus = el("p", { className: "panel-note au-status" });

  let searchSeq = 0;
  const search = async () => {
    const seq = ++searchSeq;
    results.innerHTML = "";
    libStatus.textContent = "searching…";
    try {
      const res = await library.search(providerSel.value, {
        query: query.value.trim() || (providerSel.value === "demo" ? "" : "music"),
        pageSize: 12,
        ...(kindSel.value ? { kind: kindSel.value as AudioKind } : {}),
        ...(commercial.checked ? { commercialOnly: true } : {}),
      });
      if (seq !== searchSeq) return;
      libStatus.textContent = `${res.items.length} result(s)${res.total !== undefined ? ` of ${res.total}` : ""}`;
      for (const item of res.items) results.append(resultRow(item));
    } catch (err) {
      if (seq === searchSeq) libStatus.textContent = `error: ${(err as Error).message}`;
    }
  };

  const resultRow = (item: AudioItem) => {
    const play = el("button", { textContent: "▶", title: "Preview" });
    play.onclick = () => {
      if (!item.previewUrl) return;
      if (preview.src.endsWith(item.previewUrl) && !preview.paused) return void preview.pause();
      preview.src = item.previewUrl;
      void preview.play();
    };
    const add = el("button", { textContent: "+", title: "Add at playhead", className: "au-add" });
    add.onclick = async () => {
      add.disabled = true;
      try {
        const resolved = await store(await library.resolve(item));
        importAudio(project, resolved, { volume: item.kind === "music" ? 0.5 : 1 });
      } catch (err) {
        libStatus.textContent = `add failed: ${(err as Error).message}`;
      } finally {
        add.disabled = false;
      }
    };
    const nc = item.license && !item.license.commercial;
    return el(
      "div",
      { className: "fx-row au-item" },
      el(
        "div",
        { className: "fx-row-head" },
        play,
        el("strong", { textContent: item.title, title: item.title }),
        el("span", { textContent: fmt(item.durationUs), className: "au-dim" }),
        add,
      ),
      el("span", {
        className: "au-dim",
        textContent: `${item.license?.id ?? "no license"}${nc ? " · NC" : ""}${item.creator ? ` · ${item.creator}` : ""}`,
      }),
    );
  };

  let timer = 0;
  query.oninput = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void search(), 300);
  };
  providerSel.onchange = kindSel.onchange = commercial.onchange = () => void search();

  // ---------- generate (any AudioGenerator; UI built from its description) ----------
  const genBox = el("div", { className: "fx-applied au-gen" });
  const genStatus = el("p", { className: "panel-note au-gen-status" });
  let activeJob: GenerationJob | undefined;
  const renderGenerate = () => {
    genBox.innerHTML = "";
    const gens = library.generators();
    if (!gens.length) {
      genBox.append(el("p", { className: "panel-note", textContent: "No generators (is the dev server running?)." }));
      return;
    }
    const genSel = el("select", { className: "au-gen-generator" });
    for (const g of gens) genSel.append(el("option", { value: g.id, textContent: g.label }));
    const kindSel = el("select", { className: "au-gen-kind" });
    const modelSel = el("select", { className: "au-gen-model" });
    const prompt = el("textarea", { className: "au-textarea au-gen-prompt", rows: 2, placeholder: "describe the sound" });
    const duration = el("input", { className: "au-gen-duration", type: "number", min: "0.5", step: "0.5", placeholder: "seconds (auto)" });
    const instrumental = el("input", { type: "checkbox", className: "au-gen-instrumental" });
    const voiceSel = el("select", { className: "au-gen-voice" });
    const paramsBox = el("div", { className: "fx-applied au-gen-params" });
    const terms = el("p", { className: "panel-note au-gen-terms" });
    const go = el("button", { textContent: "Generate", className: "au-gen-go" });
    const cancel = el("button", { textContent: "Cancel", className: "au-gen-cancel", disabled: true });
    const params: Record<string, unknown> = {};

    const current = (): AudioGenerator => library.generator(genSel.value)!;
    const sync = () => {
      const g = current();
      const kind = (kindSel.value || g.kinds[0]) as GenerateRequest["kind"];
      kindSel.innerHTML = "";
      for (const k of g.kinds) kindSel.append(el("option", { value: k, textContent: k, selected: k === kind }));
      modelSel.innerHTML = "";
      modelSel.append(el("option", { value: "", textContent: "default model" }));
      for (const m of g.models ?? []) if (m.kinds.includes(kind)) modelSel.append(el("option", { value: m.id, textContent: m.label }));
      prompt.placeholder = kind === "voice" ? "text to speak" : "describe the sound";
      duration.hidden = kind === "voice";
      instrumental.parentElement!.hidden = kind !== "music";
      voiceSel.hidden = kind !== "voice";
      if (kind === "voice" && g.voices && !voiceSel.options.length) {
        voiceSel.append(el("option", { value: "", textContent: "loading voices…" }));
        void g.voices().then(
          (vs) => {
            voiceSel.innerHTML = "";
            voiceSel.append(el("option", { value: "", textContent: "default voice" }));
            for (const v of vs) voiceSel.append(el("option", { value: v.id, textContent: `${v.name}${v.language ? ` (${v.language})` : ""}` }));
          },
          (err) => (voiceSel.innerHTML = `<option value="">voices failed: ${(err as Error).message}</option>`),
        );
      }
      // Vendor-specific knobs, straight from the adapter's JSON Schema.
      paramsBox.innerHTML = "";
      for (const key of Object.keys(params)) delete params[key];
      const schema: ParamsSchema | undefined = g.paramsSchema?.[kind];
      for (const [key, prop] of Object.entries(schema?.properties ?? {})) {
        const label = String(prop.title ?? key);
        if (prop.type === "boolean") {
          const box = el("input", { type: "checkbox", checked: prop.default === true });
          box.onchange = () => (params[key] = box.checked);
          paramsBox.append(el("label", { className: "fx-param" }, el("span", {}, box, ` ${label}`)));
        } else if (prop.type === "number") {
          const min = Number(prop.minimum ?? 0), max = Number(prop.maximum ?? 1);
          const out = el("span", { textContent: String(prop.default ?? "default") });
          const range = el("input", { type: "range", min: String(min), max: String(max), step: String((max - min) / 100), value: String(prop.default ?? min) });
          range.oninput = () => {
            params[key] = Number(range.value);
            out.textContent = Number(range.value).toFixed(2);
          };
          paramsBox.append(el("label", { className: "fx-param" }, el("span", {}, `${label} `, out), range));
        }
      }
      terms.textContent = `${g.terms.license.id}${g.terms.license.commercial ? "" : " · non-commercial"}${g.terms.notice ? ` — ${g.terms.notice}` : ""}`;
    };
    genSel.onchange = () => {
      voiceSel.innerHTML = "";
      sync();
    };
    kindSel.onchange = sync;

    go.onclick = async () => {
      const kind = kindSel.value as GenerateRequest["kind"];
      const text = prompt.value.trim();
      const durationS = Number(duration.value) || undefined;
      const request: GenerateRequest =
        kind === "voice"
          ? { kind, text, ...(voiceSel.value ? { voice: voiceSel.value } : {}) }
          : kind === "music"
            ? { kind, prompt: text, ...(durationS ? { durationS } : {}), ...(instrumental.checked ? { instrumental: true } : {}) }
            : { kind, prompt: text, ...(durationS ? { durationS } : {}) };
      const job = library.generate(genSel.value, request, {
        ...(modelSel.value ? { model: modelSel.value } : {}),
        ...(Object.keys(params).length ? { params: { ...params } } : {}),
      });
      activeJob = job;
      go.disabled = true;
      cancel.disabled = false;
      job.onChange((j) => {
        genStatus.textContent = `${j.status}${j.progress !== undefined && j.status === "running" ? ` ${Math.round(j.progress * 100)}%` : ""}${j.message && j.status === "running" ? ` — ${j.message}` : ""}${j.error ? ` — ${j.error}` : ""}`;
      });
      genStatus.textContent = "running…";
      try {
        const { resolved } = await job.result;
        importAudio(project, resolved, { volume: kind === "music" ? 0.5 : 1 });
        genStatus.textContent = `added “${resolved.name}” (${fmt(resolved.durationUs)}, ${resolved.license?.id})`;
      } catch {
        /* status line shows the error */
      } finally {
        go.disabled = false;
        cancel.disabled = true;
        activeJob = undefined;
      }
    };
    cancel.onclick = () => activeJob?.cancel();

    genBox.append(
      el("div", { className: "fx-controls" }, genSel, kindSel),
      el("div", { className: "fx-controls" }, modelSel, voiceSel),
      prompt,
      el("div", { className: "fx-controls" }, duration, el("label", { className: "panel-note" }, instrumental, " instrumental")),
      paramsBox,
      terms,
      el("div", { className: "fx-controls" }, go, cancel),
    );
    sync();
  };
  void generatorsReady.then(renderGenerate);
  const offGenerators = library.onGeneratorsChange(renderGenerate);

  // ---------- project audio (fades, volume, waveform) ----------
  const clipsBox = el("div", { className: "fx-applied au-clips" });
  const renderClips = () => {
    clipsBox.innerHTML = "";
    const doc = project.getState().doc;
    const clips = Object.values(doc.clips).filter(isAudioClip) as AudioClip[];
    if (!clips.length) clipsBox.append(el("p", { className: "panel-note", textContent: "No audio clips yet." }));
    for (const clip of clips) clipsBox.append(clipRow(clip));
  };

  const slider = (label: string, value: number, max: number, step: number, show: (v: number) => string, apply: (v: number) => void) => {
    const out = el("span", { textContent: show(value) });
    const input = el("input", { type: "range", min: "0", max: String(max), step: String(step), value: String(value) });
    input.oninput = () => (out.textContent = show(Number(input.value)));
    input.onchange = () => apply(Number(input.value)); // commit on release: one undo step
    return el("label", { className: "fx-param" }, el("span", {}, `${label} `, out), input);
  };

  const clipRow = (clip: AudioClip) => {
    const asset = project.getState().doc.assets[clip.assetId];
    const canvas = el("canvas", { className: "au-wave", width: 260, height: 36 });
    if (asset && asset.durationUs) {
      let p = waveforms.get(asset.src);
      if (!p) {
        p = openMediabunnyAudio(asset.id, asset.src)
          .then(async (source) => {
            if (!source) return null;
            try {
              return await computeWaveformPeaks(source, { durationUs: asset.durationUs! });
            } finally {
              source.dispose();
            }
          })
          .catch(() => null);
        waveforms.set(asset.src, p);
      }
      void p.then((wf) => wf && drawWave(canvas, wf, clip));
    }
    const fadeMax = Math.min(10 * S, clip.durationUs);
    const set = (patch: Record<string, unknown>) => project.dispatch({ type: "clip/set-property", payload: { clipId: clip.id, ...patch } });
    const remove = el("button", { textContent: "✕", title: "Remove clip" });
    remove.onclick = () => project.dispatch({ type: "clip/remove", payload: { clipId: clip.id } });
    return el(
      "div",
      { className: "fx-row au-clip" },
      el("div", { className: "fx-row-head" }, el("strong", { textContent: asset?.name ?? clip.assetId }), el("span", { className: "au-dim", textContent: `@${fmt(clip.startUs)}` }), remove),
      canvas,
      slider("volume", Math.round(clip.volume * 100), 200, 1, (v) => `${v}%`, (v) => set({ volume: v / 100 })),
      slider("fade in", clip.fadeInUs ?? 0, fadeMax, 100_000, fmt, (v) => set({ fadeInUs: v || null })),
      slider("fade out", clip.fadeOutUs ?? 0, fadeMax, 100_000, fmt, (v) => set({ fadeOutUs: v || null })),
    );
  };

  // ---------- credits & licenses ----------
  const licenseBox = el("pre", { className: "au-pre au-license" });
  const commercialUse = el("input", { type: "checkbox", className: "au-commercial-use" });
  const renderLicense = () => {
    const doc = project.getState().doc;
    const credits = creditsFor(doc);
    const issues = licenseReport(doc, { commercial: commercialUse.checked });
    licenseBox.textContent =
      (credits.length ? `Credits:\n${credits.join("\n")}` : "Credits: none needed") +
      `\n\nLicense report (${commercialUse.checked ? "commercial" : "non-commercial"}):\n` +
      (issues.length ? issues.map((i) => `• [${i.kind}] ${i.message}`).join("\n") : "no issues");
  };
  commercialUse.onchange = renderLicense;

  // ---------- AI tools ----------
  const toolInput = el("textarea", {
    className: "au-tool-input",
    rows: 3,
    value: JSON.stringify({ name: "search_audio", input: { query: "whoosh", kind: "sfx" } }),
  });
  const toolOut = el("pre", { className: "au-pre au-tool-out" });
  const runTool = el("button", { textContent: "Run tool", className: "au-run-tool" });
  runTool.onclick = async () => {
    try {
      const { name, input } = JSON.parse(toolInput.value) as { name: string; input: unknown };
      await generatorsReady;
      toolOut.textContent = JSON.stringify(await runAudioTool(name, input, { library, project, store }), null, 1);
    } catch (err) {
      toolOut.textContent = `error: ${(err as Error).message}`;
    }
  };
  const defsPre = el("pre", { className: "au-pre au-tool-defs", textContent: JSON.stringify(audioToolDefinitions(library), null, 1) });
  const defs = el("details", {}, el("summary", { textContent: "Tool definitions" }), defsPre);
  void generatorsReady.then(() => (defsPre.textContent = JSON.stringify(audioToolDefinitions(library), null, 1)));

  body.append(
    el("p", { className: "panel-note", textContent: "Library → + adds at the playhead (importAudio: one undo). Sliders commit on release." }),
    el("div", { className: "fx-controls" }, providerSel, kindSel),
    el("div", { className: "fx-controls" }, query),
    el("label", { className: "panel-note" }, commercial, " commercial-safe only"),
    libStatus,
    results,
    el("strong", { textContent: "Generate" }),
    genBox,
    genStatus,
    el("strong", { textContent: "Project audio" }),
    clipsBox,
    el("strong", { textContent: "Credits & licenses" }),
    el("label", { className: "panel-note" }, commercialUse, " commercial use"),
    licenseBox,
    el("strong", { textContent: "AI tools" }),
    toolInput,
    runTool,
    toolOut,
    defs,
  );

  const refresh = () => {
    renderClips();
    renderLicense();
  };
  // Re-render on document changes (cheap at playground scale).
  let lastDoc = project.getState().doc;
  const off = project.store.subscribe((s) => {
    if (s.doc === lastDoc) return;
    lastDoc = s.doc;
    refresh();
  });
  refresh();
  void search();
  return () => {
    off();
    offGenerators();
    activeJob?.cancel();
    preview.pause();
    clearTimeout(timer);
  };
}

function drawWave(canvas: HTMLCanvasElement, wf: WaveformPeaks, clip: AudioClip): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cols = peaksForRange(wf, clip.trimStartUs, clip.trimStartUs + clip.durationUs, Math.floor(canvas.width / 2));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#8fd18f";
  const mid = canvas.height / 2;
  for (let x = 0; x < cols.length; x++) {
    const db = cols[x]! > 0 ? 20 * Math.log10(cols[x]! * clip.volume) : -60;
    const h = Math.max(1, Math.min(1, Math.max(0, (db + 60) / 60)) * (canvas.height - 2));
    ctx.fillRect(x * 2, mid - h / 2, 1, h);
  }
  // Fade wedges.
  const { inUs, outUs } = clipFades(clip);
  const pxPerUs = canvas.width / clip.durationUs;
  ctx.fillStyle = "rgba(0,0,0,.45)";
  if (inUs) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(inUs * pxPerUs, 0); ctx.lineTo(0, canvas.height); ctx.fill();
  }
  if (outUs) {
    const w = canvas.width;
    ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - outUs * pxPerUs, 0); ctx.lineTo(w, canvas.height); ctx.fill();
  }
}
