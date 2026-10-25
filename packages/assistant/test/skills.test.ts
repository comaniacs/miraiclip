import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { createAssistant, MIRAICLIP_SKILLS, parseSkill, scriptedChatModel, skillsFromFiles, skillTools, type AssistantTool } from "../src/index.js";

const skillMd = (name: string, description: string, body: string) => `---\nname: ${name}\ndescription: "${description}"\n---\n\n${body}\n`;

describe("parseSkill / skillsFromFiles", () => {
  it("reads the front matter and body", () => {
    const s = parseSkill(skillMd("captions", "Add captions: karaoke, pop", "# Captions\n\nDo it."));
    expect(s).toEqual({ name: "captions", description: "Add captions: karaoke, pop", instructions: "# Captions\n\nDo it." });
  });

  it("rejects skills without a description or with a bad name", () => {
    expect(() => parseSkill("---\nname: x\n---\nbody")).toThrow(/description/);
    expect(() => parseSkill(skillMd("Bad Name", "d", "b"))).toThrow(/name/);
  });

  it("groups files by skill folder, prefers the entry file and keeps the others as references", () => {
    const files = {
      "/plugin/skills/edit-video/SKILL.md": skillMd("edit-video", "Claude Code version", "cli body"),
      "/plugin/skills/edit-video/EDITOR.md": "---\ndescription: Editor version\n---\neditor body",
      "/plugin/skills/edit-video/reference/craft.md": "# Craft",
      "/plugin/skills/reformat/SKILL.md": skillMd("reformat", "only for Claude Code", "x"),
    };
    expect(skillsFromFiles(files, { entry: ["EDITOR.md"] })).toEqual([
      { name: "edit-video", description: "Editor version", instructions: "editor body", files: { "reference/craft.md": "# Craft" } },
    ]);
    expect(skillsFromFiles(files).map((s) => [s.name, s.instructions])).toEqual([
      ["edit-video", "cli body"],
      ["reformat", "x"],
    ]);
  });
});

describe("skill tools", () => {
  const [load, read] = skillTools([
    { name: "captions", description: "d", instructions: "playbook", files: { "reference/long.md": `${"a".repeat(14_000)}\n\n${"b".repeat(14_000)}` } },
  ]) as [AssistantTool, AssistantTool];
  const project = createProject({ width: 1280, height: 720, fps: 30 });

  it("load_skill returns the playbook and the file list", () => {
    expect(load.run({ name: "captions" }, { project })).toEqual({ ok: true, result: { name: "captions", instructions: "playbook", files: ["reference/long.md"] } });
    expect(load.run({ name: "nope" }, { project })).toMatchObject({ ok: false });
  });

  it("read_skill_file pages long files", () => {
    const first = read.run({ skill: "captions", path: "reference/long.md" }, { project }) as { ok: true; result: { part: number; parts: number; content: string } };
    expect(first.result).toMatchObject({ part: 1, parts: 2 });
    expect(first.result.content).toMatch(/^a+$/);
    const second = read.run({ skill: "captions", path: "./reference/long.md", part: 2 }, { project }) as { ok: true; result: { content: string } };
    expect(second.result.content).toMatch(/^b+$/);
    expect(read.run({ skill: "captions", path: "missing.md" }, { project })).toMatchObject({ ok: false, error: expect.stringMatching(/reference\/long\.md/) });
  });
});

describe("createAssistant({ skills })", () => {
  const skills = [{ name: "captions", description: "Add captions.", instructions: "CAPTIONS PLAYBOOK", files: { "reference/x.md": "X" } }];

  it("lists skills in the system prompt and offers the skill tools", async () => {
    const model = scriptedChatModel([{ toolCalls: [{ name: "load_skill", arguments: { name: "captions" } }] }, "Done."]);
    const turn = await createAssistant({ model, skills }).run(createProject({ width: 1280, height: 720, fps: 30 }), "caption it");
    const system = model.requests[0]!.messages[0]!.content;
    expect(system).toContain("- captions: Add captions.");
    expect(system).not.toContain("CAPTIONS PLAYBOOK");
    expect(model.requests[0]!.tools!.map((t) => t.name)).toEqual(expect.arrayContaining(["load_skill", "read_skill_file"]));
    expect(model.requests[1]!.messages.at(-1)!.content).toContain("CAPTIONS PLAYBOOK");
    expect(turn.status).toBe("no-changes");
  });

  it("preloads skills named on the turn", async () => {
    const model = scriptedChatModel(["Done."]);
    await createAssistant({ model, skills }).run(createProject({ width: 1280, height: 720, fps: 30 }), "go", { skills: ["captions", "unknown"] });
    const system = model.requests[0]!.messages[0]!.content;
    expect(system).toContain('started this request with the "captions" skill');
    expect(system).toContain("CAPTIONS PLAYBOOK");
    expect(system).toContain("reference/x.md");
  });

  it("adds nothing without skills", async () => {
    const model = scriptedChatModel(["Done."]);
    await createAssistant({ model }).run(createProject({ width: 1280, height: 720, fps: 30 }), "go");
    expect(model.requests[0]!.tools!.map((t) => t.name)).not.toContain("load_skill");
    expect(model.requests[0]!.messages[0]!.content).not.toContain("Skills (playbooks");
  });
});

describe("MIRAICLIP_SKILLS", () => {
  it("bundles the plugin's editor skills, with their references", () => {
    const names = MIRAICLIP_SKILLS.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["edit-video", "captions", "reformat", "launch-video", "talking-head", "screen-tutorial", "make-template"]));
    // Skills by job: direction, look, media and sound, the sequence contract, and motion.
    expect(names).toEqual(expect.arrayContaining(["make-film", "direction", "look", "media-sound", "sequence-core", "motion"]));
    const motion = MIRAICLIP_SKILLS.find((s) => s.name === "motion")!;
    expect(Object.keys(motion.files ?? {}).filter((f) => f.startsWith("reference/rules/")).length).toBeGreaterThanOrEqual(25);
    expect(Object.keys(motion.files ?? {}).filter((f) => f.startsWith("reference/breakdowns/")).length).toBeGreaterThanOrEqual(5);
    // Recipes route to the job skills and never tell the model to fill templates.
    for (const recipe of ["make-film", "launch-video"]) {
      const s = MIRAICLIP_SKILLS.find((x) => x.name === recipe)!;
      expect(s.instructions, recipe).toMatch(/direction/);
      expect(s.instructions, recipe).not.toMatch(/one `add_scene` call per beat|fill in the scene/i);
    }
    const edit = MIRAICLIP_SKILLS.find((s) => s.name === "edit-video")!;
    expect(Object.keys(edit.files ?? {})).toEqual(expect.arrayContaining(["reference/craft.md", "reference/html-recipes.md"]));
    // Editor playbooks don't drive the Claude Code CLI.
    for (const s of MIRAICLIP_SKILLS) expect(s.instructions).not.toMatch(/CLAUDE_PLUGIN_ROOT|mc\.mjs|preview_frame/);
  });

  it("is up to date with plugins/miraiclip/skills", () => {
    const script = fileURLToPath(new URL("../scripts/bundle-skills.mjs", import.meta.url));
    expect(() => execFileSync(process.execPath, [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
