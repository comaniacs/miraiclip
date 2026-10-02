# @miraiclip/assistant

An AI editing assistant for [Miraiclip](https://comaniacs.github.io/miraiclip/) editors. The user asks in plain words; the project changes as **one undo step**.

- **Any model**: one small `ChatModel` contract. OpenAI ships first (`openAIChatModel`, Chat Completions with function calling and streaming); `baseUrl` reaches any OpenAI-compatible server (Azure OpenAI, OpenRouter, Groq, vLLM, Ollama…).
- **Safe edits**: the agent works on a copy of the project; when the request finishes, its commands replay onto the real project in one transaction. Failed or canceled requests leave nothing behind. Review mode waits for `turn.apply()`.
- **Editing tools**: `get_state`, `get_command_schema`, `apply_commands`, `add_transition` (cuts, spare-footage aware), `animate_clip` (in / loop / out presets), plus `defineTool` and `toolsFromDefinitions` for your own (e.g. `@miraiclip/audio-sources`).
- **Keys stay on the server**: `createChatHandler` (Fetch API) on your backend, `remoteChatModel` in the browser.

```ts
import { createAssistant, openAIChatModel } from "@miraiclip/assistant";

const assistant = createAssistant({ model: openAIChatModel({ apiKey, model: "gpt-5.4-mini" }) });
const turn = await assistant.run(project, "add dissolves between the clips and make the title pop in");
turn.reply;   // what the model says it did
turn.changes; // ["Added crossDissolve at 10s (0.6s)", …]
```

Docs: https://comaniacs.github.io/miraiclip/docs/assistant/

MIT
