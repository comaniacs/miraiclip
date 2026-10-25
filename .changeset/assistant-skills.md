---
"@miraiclip/assistant": minor
---

Skills: playbooks the assistant loads when a request needs one. `createAssistant({ skills })` lists each skill's name and description in the system prompt and adds `load_skill` and `read_skill_file` tools, so the model reads a playbook (and its reference files, in parts when long) only when it uses it. `run(project, request, { skills: ["captions"] })` starts a request with a skill already loaded, e.g. from a button. `MIRAICLIP_SKILLS` bundles the Claude Code plugin's skills in their editor versions (edit-video, captions, talking-head, launch-video, screen-tutorial, reformat, make-template) with their references; unused, it's tree-shaken. `parseSkill`, `skillsFromFiles` (a folder of skill folders, e.g. from `import.meta.glob`) and `defineSkill` load your own.
