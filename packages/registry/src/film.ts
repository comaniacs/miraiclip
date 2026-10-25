/**
 * Film formats and styles: the vocabulary an assistant uses to decide what
 * kind of film a brief wants before it picks scenes.
 *
 * A format is the grammar (which scenes, in what order, at what pace): a
 * product launch, a trailer, a documentary, an explainer. A style is the
 * look (palette, typefaces, grain, letterbox, transitions, music mood).
 * Styles are references, not a closed list: a brief that fits none of them
 * gets a custom style built from the same tokens.
 */

export const FILM_FORMATS = ["launch", "course", "trailer", "documentary", "explainer"] as const;
export type FilmFormat = (typeof FILM_FORMATS)[number];

export interface FilmFormatInfo {
  name: FilmFormat;
  description: string;
  /** The beat order, in words, for the playbook and the plan_film result. */
  grammar: string;
  /** Scenes that may only open the film. */
  openers: string[];
  /** Scenes that end the film (one, last). */
  closers: string[];
  defaultStyle: string;
}

export const FORMAT_INFO: Record<FilmFormat, FilmFormatInfo> = {
  launch: {
    name: "launch",
    description: "Product launch, teaser or promo for a product, app, service or business: fast, bright, brand-led.",
    grammar: "hook (name the viewer's problem) → product hero → 2–4 feature beats (UI, chat, notifications, steps) → proof (stat, quote, montage) → a statement or slam → wordmark outro with the CTA.",
    openers: ["scene-hook-typed"],
    closers: ["scene-wordmark-outro"],
    defaultStyle: "brand",
  },
  course: {
    name: "course",
    description: "Promo or trailer for a course, class, bootcamp, workshop, certification or learning programme: who it's for, what you learn and build, who teaches, what you leave with, how to enrol.",
    grammar: "hook (the learner's goal or problem, as a question) → course title (level, length, format) → syllabus → a lesson moment (lesson in a player, or a still) → projects you'll build → instructor or mentor (real) → skills and certificate → proof (real stat or quote) → enrol card.",
    openers: ["scene-hook-typed"],
    closers: ["scene-course-enroll"],
    defaultStyle: "academy",
  },
  trailer: {
    name: "trailer",
    description: "Trailer or teaser for a show, film, book, game, event or story: tension that builds, then a title reveal.",
    grammar: "cold open (quiet line) → title card → act one: who (character cards, stills with captions) → act two: the stakes (quotes, case file, montage) → build: trailer hits / word slams, shorter scenes → title reveal with the closing line.",
    openers: ["scene-doc-cold-open"],
    closers: ["scene-doc-reveal"],
    defaultStyle: "documentary",
  },
  documentary: {
    name: "documentary",
    description: "Documentary, biography, history, true story, recap or profile: slow, factual, captioned.",
    grammar: "cold open → title card → chapters (chapter card, then stills with captions, characters, facts, quotes, a stat or a case file) → title reveal.",
    openers: ["scene-doc-cold-open"],
    closers: ["scene-doc-reveal"],
    defaultStyle: "documentary",
  },
  explainer: {
    name: "explainer",
    description: "How-it-works, tutorial teaser or concept explainer: the problem, the steps, the result.",
    grammar: "hook (the question) → statement of the problem → steps → 1–3 detail beats (UI zoom, before/after, feature trio) → stat → outro.",
    openers: ["scene-hook-typed"],
    closers: ["scene-wordmark-outro"],
    defaultStyle: "midnight",
  },
};

export interface FilmStyleTokens {
  primary: string;
  secondary: string;
  bg: string;
  ink: string;
  /** Body typeface. */
  font: string;
  /** Title typeface. */
  display: string;
}

export interface FilmStyle {
  name: string;
  label: string;
  /** When to use it. */
  description: string;
  /** Formats it suits (a style can serve any format; these are its natural ones). */
  formats: FilmFormat[];
  /** Palette and typefaces; omitted for `brand`, which uses the brand's own. */
  tokens?: FilmStyleTokens;
  /** The scenes' starting look, and whether long films rotate light / dark / brand looks. */
  look: "light" | "dark" | "brand";
  rotateLooks: boolean;
  /** Film overlay: grain 0–0.3, vignette 0–1, letterbox bars. 0 / false = no overlay. */
  grain: number;
  vignette: number;
  letterbox: boolean;
  /** Scene lengths: fast = low end of each scene's range, slow = high end. */
  pace: "fast" | "medium" | "slow";
  /** Between scenes: a dissolve, a dip through the background, or a hard cut. */
  transition: { kind: "dissolve" | "dip" | "cut"; seconds: number };
  /** Words for the music search. */
  music: string;
}

export const FILM_STYLES: FilmStyle[] = [
  {
    name: "brand",
    label: "Brand",
    description: "The brand's own colours and font, bright and fast — the default for products and businesses.",
    formats: ["launch", "course", "explainer"],
    look: "light",
    rotateLooks: true,
    grain: 0,
    vignette: 0,
    letterbox: false,
    pace: "fast",
    transition: { kind: "dissolve", seconds: 0.3 },
    music: "upbeat modern electronic, driving",
  },
  {
    name: "academy",
    label: "Academy",
    description: "Calm and confident learning look: warm white paper, deep navy ink, one bright blue accent and a warm orange, a serif for titles, a notebook grid. For courses, schools, workshops and educational explainers without a brand of their own.",
    formats: ["course", "explainer"],
    tokens: { primary: "#2f5bff", secondary: "#ff8a3d", bg: "#fbfaf6", ink: "#14213d", font: "Inter", display: "Playfair Display" },
    look: "light",
    rotateLooks: false,
    grain: 0,
    vignette: 0,
    letterbox: false,
    pace: "medium",
    transition: { kind: "dissolve", seconds: 0.45 },
    music: "warm inspiring acoustic, light piano, steady pulse",
  },
  {
    name: "documentary",
    label: "Documentary",
    description: "Streaming-documentary look: near-black, warm off-white serif titles, one blood-red accent, grain, letterbox, slow dips. For true stories, crime, mystery, drama, biography, TV shows and films.",
    formats: ["documentary", "trailer"],
    tokens: { primary: "#b8262c", secondary: "#8a8478", bg: "#0a0a0b", ink: "#ebe5d9", font: "Inter", display: "Playfair Display" },
    look: "light",
    rotateLooks: false,
    grain: 0.14,
    vignette: 0.55,
    letterbox: true,
    pace: "slow",
    transition: { kind: "dip", seconds: 0.8 },
    music: "dark ambient documentary, low strings, slow pulse, tension",
  },
  {
    name: "hype",
    label: "Hype",
    description: "Action-trailer energy: black, white condensed caps, a hot accent, hard cuts. For sports, games, events, drops and action.",
    formats: ["trailer", "launch"],
    tokens: { primary: "#ff3b30", secondary: "#ffd60a", bg: "#050505", ink: "#ffffff", font: "Inter", display: "Bebas Neue" },
    look: "light",
    rotateLooks: false,
    grain: 0.08,
    vignette: 0.4,
    letterbox: false,
    pace: "fast",
    transition: { kind: "cut", seconds: 0 },
    music: "epic trailer, hits, risers, braams, fast build",
  },
  {
    name: "midnight",
    label: "Midnight",
    description: "Deep navy with cool violet light and a geometric sans. For tech, AI, finance, explainers and night-time moods.",
    formats: ["explainer", "launch"],
    tokens: { primary: "#7c9cff", secondary: "#c084fc", bg: "#0b1020", ink: "#e8ecf8", font: "Inter", display: "Space Grotesk" },
    look: "light",
    rotateLooks: false,
    grain: 0,
    vignette: 0.3,
    letterbox: false,
    pace: "medium",
    transition: { kind: "dissolve", seconds: 0.4 },
    music: "atmospheric synth, steady pulse",
  },
  {
    name: "paper",
    label: "Paper",
    description: "Warm cream paper, ink-dark text, an italic serif and earthy accents. For food, craft, books, education, wellness and slow stories.",
    formats: ["documentary", "explainer"],
    tokens: { primary: "#c2410c", secondary: "#3f6212", bg: "#f4efe6", ink: "#1d1a16", font: "Inter", display: "Instrument Serif" },
    look: "light",
    rotateLooks: false,
    grain: 0.06,
    vignette: 0.2,
    letterbox: false,
    pace: "medium",
    transition: { kind: "dissolve", seconds: 0.5 },
    music: "warm acoustic, light piano",
  },
  {
    name: "terminal",
    label: "Terminal",
    description: "Black screen, phosphor green, monospaced everything, hard cuts. For developer tools, security, hacking and retro tech.",
    formats: ["launch", "explainer", "trailer"],
    tokens: { primary: "#22c55e", secondary: "#a3e635", bg: "#0a0f0a", ink: "#d6f5d6", font: "JetBrains Mono", display: "JetBrains Mono" },
    look: "light",
    rotateLooks: false,
    grain: 0.05,
    vignette: 0.45,
    letterbox: false,
    pace: "fast",
    transition: { kind: "cut", seconds: 0 },
    music: "minimal electronic, glitchy beat",
  },
  {
    name: "pop",
    label: "Pop",
    description: "Bright, loud and friendly: cream, hot pink, sunflower, a heavy display face, hard cuts. For kids, consumer apps, social, food and fun.",
    formats: ["launch", "explainer"],
    tokens: { primary: "#ff4d8d", secondary: "#ffb703", bg: "#fff7e6", ink: "#1a1a1a", font: "Inter", display: "Archivo Black" },
    look: "light",
    rotateLooks: true,
    grain: 0,
    vignette: 0,
    letterbox: false,
    pace: "fast",
    transition: { kind: "cut", seconds: 0 },
    music: "upbeat pop, claps, bright",
  },
  {
    name: "editorial",
    label: "Editorial",
    description: "Magazine restraint: off-white, black, one muted gold, an italic serif, slow dissolves. For luxury, fashion, architecture, real estate and portfolios.",
    formats: ["documentary", "launch"],
    tokens: { primary: "#111111", secondary: "#9a8c73", bg: "#f7f5f0", ink: "#111111", font: "Inter", display: "Instrument Serif" },
    look: "light",
    rotateLooks: false,
    grain: 0.04,
    vignette: 0.15,
    letterbox: true,
    pace: "slow",
    transition: { kind: "dissolve", seconds: 0.7 },
    music: "minimal piano, elegant, sparse",
  },
];

/** The scene's formats, from its `format:*` tags. */
export const sceneFormats = (tags: readonly string[]): FilmFormat[] =>
  tags.filter((t) => t.startsWith("format:")).map((t) => t.slice(7) as FilmFormat);
