import { defineTool, type AssistantTool } from "./tools.js";

/**
 * Skills: playbooks for bigger jobs (a launch video, captions, a reformat),
 * loaded by the model only when a request needs one.
 *
 * The system prompt lists each skill's name and description. The model calls
 * `load_skill` to read one, and `read_skill_file` for the reference files it
 * points to, so the prompt stays small however many skills there are. An app
 * can also start a request with a skill already loaded (`TurnOptions.skills`),
 * e.g. from a button.
 *
 * Skills are plain Markdown with a front matter (`name`, `description`), the
 * same shape as Claude Code skills. `MIRAICLIP_SKILLS` are the Miraiclip
 * plugin's skills, in their editor versions.
 */
export interface AssistantSkill {
  /** Lowercase letters, digits and dashes, e.g. "captions". */
  name: string;
  /** When to use it, in one or two sentences. The model picks skills by this. */
  description: string;
  /** The playbook (Markdown, without the front matter). */
  instructions: string;
  /** Reference files the playbook points to, by relative path ("reference/craft.md"). */
  files?: Readonly<Record<string, string>>;
}

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function defineSkill(skill: AssistantSkill): AssistantSkill {
  if (!NAME.test(skill.name)) throw new Error(`Skill name must match ${NAME} (got "${skill.name}")`);
  if (!skill.description.trim()) throw new Error(`Skill "${skill.name}" needs a description`);
  return skill;
}

/** Split `---\nkey: value\n---\nbody` into its fields and body. Values may be quoted. */
export function parseFrontMatter(markdown: string): { data: Record<string, string>; body: string } {
  const text = markdown.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text.trim() };
  const data: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    data[kv[1]!] = value;
  }
  return { data, body: text.slice(match[0].length).trim() };
}

/** One skill from its Markdown (front matter `name` and `description`). */
export function parseSkill(markdown: string, options: { name?: string; description?: string; files?: Record<string, string> } = {}): AssistantSkill {
  const { data, body } = parseFrontMatter(markdown);
  const name = data.name || options.name;
  const description = data.description || options.description;
  if (!name) throw new Error("Skill has no name (front matter `name:`)");
  if (!description) throw new Error(`Skill "${name}" has no description (front matter \`description:\`)`);
  return defineSkill({ name, description, instructions: body, ...(options.files && Object.keys(options.files).length ? { files: options.files } : {}) });
}

export interface SkillsFromFilesOptions {
  /**
   * Which file in a skill folder is the playbook, in order of preference.
   * Default `["SKILL.md"]`. The Miraiclip plugin keeps the Claude Code
   * version in SKILL.md and the in-editor version in EDITOR.md, so an editor
   * passes `["EDITOR.md"]` (folders without one are skipped). The other
   * entry file's front matter fills in a missing name or description.
   */
  entry?: string[];
}

/**
 * Skills from a folder of skill folders, given as `{ path: text }` — e.g.
 * Vite's `import.meta.glob("./skills/**\/*.md", { query: "?raw", import: "default", eager: true })`.
 * Every other `.md` in a skill's folder becomes one of its files.
 */
export function skillsFromFiles(files: Record<string, string>, options: SkillsFromFilesOptions = {}): AssistantSkill[] {
  const entry = options.entry ?? ["SKILL.md"];
  const ENTRY_FILES = new Set([...entry, "SKILL.md", "EDITOR.md"]);
  const paths = Object.keys(files).map((p) => p.replace(/\\/g, "/"));
  const original = new Map(Object.keys(files).map((p) => [p.replace(/\\/g, "/"), p]));
  const read = (p: string) => files[original.get(p) ?? p]!;
  // A skill folder is any folder holding one of the entry files.
  const dirs = [...new Set(paths.filter((p) => ENTRY_FILES.has(base(p))).map(dirname))].sort((a, b) => b.length - a.length);
  const skills: AssistantSkill[] = [];
  for (const dir of [...dirs].sort()) {
    const main = entry.map((f) => join(dir, f)).find((p) => p in files || original.has(p));
    if (!main) continue;
    const others = [...ENTRY_FILES].map((f) => join(dir, f)).filter((p) => p !== main && original.has(p));
    const fallback = others.map((p) => parseFrontMatter(read(p)).data).find((d) => d.name || d.description) ?? {};
    const own: Record<string, string> = {};
    for (const p of paths) {
      if (!p.startsWith(`${dir}/`) || !p.endsWith(".md") || ENTRY_FILES.has(p.slice(dir.length + 1))) continue;
      // Files of a nested skill folder belong to that skill.
      if (dirs.some((d) => d !== dir && d.startsWith(`${dir}/`) && p.startsWith(`${d}/`))) continue;
      own[p.slice(dir.length + 1)] = read(p);
    }
    skills.push(parseSkill(read(main), { name: fallback.name ?? base(dir), ...(fallback.description ? { description: fallback.description } : {}), files: own }));
  }
  return skills;
}

/** The skill list for the system prompt. */
export function describeSkills(skills: readonly AssistantSkill[]): string {
  if (!skills.length) return "";
  return [
    "Skills (playbooks for bigger jobs):",
    ...skills.map((s) => `- ${s.name}: ${s.description}`),
    "When a request matches a skill, call load_skill with its name before your first edit and follow it. It may point to reference files: read them with read_skill_file when the step you're on needs them. A skill loaded in an earlier request may have been shortened in the history: load it again if you need it.",
  ].join("\n");
}

/** `load_skill` and `read_skill_file` for these skills. */
export function skillTools(skills: readonly AssistantSkill[]): AssistantTool[] {
  if (!skills.length) return [];
  const byName = new Map(skills.map((s) => [s.name, s]));
  const names = skills.map((s) => s.name);
  return [
    defineTool({
      name: "load_skill",
      description: "Read a skill's playbook (see the skill list in the instructions). Call it before starting a job that matches one, then follow it.",
      inputSchema: { type: "object", properties: { name: { type: "string", enum: names } }, required: ["name"], additionalProperties: false },
      run(input) {
        const skill = byName.get(String(input.name));
        if (!skill) return { ok: false, error: `unknown skill "${input.name}"; skills are ${names.join(", ")}` };
        return { ok: true, result: { name: skill.name, instructions: skill.instructions, files: Object.keys(skill.files ?? {}) } };
      },
    }),
    defineTool({
      name: "read_skill_file",
      description: "Read a reference file of a skill (paths as load_skill lists them, e.g. reference/craft.md). Long files come in parts: pass `part` for the next one.",
      inputSchema: {
        type: "object",
        properties: { skill: { type: "string", enum: names }, path: { type: "string" }, part: { type: "integer", minimum: 1 } },
        required: ["skill", "path"],
        additionalProperties: false,
      },
      run(input) {
        const skill = byName.get(String(input.skill));
        if (!skill) return { ok: false, error: `unknown skill "${input.skill}"; skills are ${names.join(", ")}` };
        const path = String(input.path).replace(/^\.\//, "");
        const text = skill.files?.[path];
        if (text === undefined) return { ok: false, error: `"${skill.name}" has no file "${path}"; its files are ${Object.keys(skill.files ?? {}).join(", ") || "none"}` };
        const parts = chunk(text, FILE_PART);
        const part = Math.min(Math.max(1, Number(input.part) || 1), parts.length);
        return { ok: true, result: { skill: skill.name, path, ...(parts.length > 1 ? { part, parts: parts.length } : {}), content: parts[part - 1] } };
      },
    }),
  ];
}

/** Below the agent's tool-result cap, split on paragraph breaks. */
const FILE_PART = 15_000;

function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max / 2) cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) out.push(rest);
  return out;
}

const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (dir: string, f: string) => (dir ? `${dir}/${f}` : f);
