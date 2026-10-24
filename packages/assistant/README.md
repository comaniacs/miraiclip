# @miraiclip/assistant

An AI editing assistant for [Miraiclip](https://docs.miraiclip.com/) editors. The user asks in plain words; the project changes as **one undo step**.

- **Any model, any provider**: one small `ChatModel` contract with native adapters for OpenAI, Anthropic and Google Gemini, and one factory for the rest — `createChatModel({ provider, apiKey, model })` covers OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. Live model lists (`listModels`), several providers behind one model (`routedChatModel`, "provider/model" ids), and every configured key from env in one call (`chatModelsFromEnv`).
- **Bring your own key**: `createChatHandler(model, { userKeys: true })` lets each user call with their own provider key, per request, never stored.
- **Safe edits**: the agent works on a copy of the project; when the request finishes, its commands replay onto the real project in one transaction. Failed or canceled requests leave nothing behind. Review mode waits for `turn.apply()`.
- **Editing tools**: `get_state`, `get_command_schema`, `apply_commands`, `add_transition` (cuts, spare-footage aware), `animate_clip` (in / loop / out presets), plus `defineTool` and `toolsFromDefinitions` for your own (e.g. `@miraiclip/audio-sources`).
- **Keys stay on the server**: `createChatHandler` (Fetch API) on your backend, `remoteChatModel` in the browser.

```ts
import { createAssistant, createChatModel } from "@miraiclip/assistant";

const model = createChatModel({ provider: "anthropic", apiKey, model: "claude-sonnet-5-5" }); // or "openai", "gemini", "openrouter", "ollama", …
const assistant = createAssistant({ model });
const turn = await assistant.run(project, "add dissolves between the clips and make the title pop in");
turn.reply;   // what the model says it did
turn.changes; // ["Added crossDissolve at 10s (0.6s)", …]
```

Docs: https://docs.miraiclip.com/ai/assistant · models and keys: https://docs.miraiclip.com/ai/models

MIT
