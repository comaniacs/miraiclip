export type {
  ChatImage,
  ChatMessage,
  ChatModel,
  ChatModelInfo,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ChatUsage,
  FetchLike,
  ModelEntry,
  ToolCall,
  ToolSpec,
} from "./types.js";
export { ChatModelError, defineChatModel } from "./types.js";

export { openAIChatModel, toOpenAIMessages, parseToolArguments, retryDelayMs } from "./openai.js";
export type { OpenAIChatModelOptions } from "./openai.js";
export { anthropicChatModel, toAnthropicMessages } from "./anthropic.js";
export type { AnthropicChatModelOptions } from "./anthropic.js";
export { geminiChatModel, toGeminiContents } from "./gemini.js";
export type { GeminiChatModelOptions } from "./gemini.js";

export { AI_PROVIDERS, aiProvider, chatModelsFromEnv, createChatModel, routedChatModel, splitModelRef } from "./providers.js";
export type { AiProviderInfo, ChatModelsFromEnvOptions, CreateChatModelOptions, ProviderApi, RoutedChatModelOptions } from "./providers.js";

export { createChatHandler, remoteChatModel, USER_KEY_HEADERS, userKeyHeaders } from "./http.js";
export { rateLimitedChatModel } from "./limits.js";
export type { RateLimitOptions } from "./limits.js";
export type { ChatHandlerOptions, RemoteChatModelOptions, RemoteModelInfo, UserCredentials, UserKeyInfo, UserKeyOptions } from "./http.js";

export { describeForAssistant } from "./state.js";
export { unknownFields } from "./strict.js";
export { assetRefs, markupProblem } from "./markup.js";
export type { UnknownFields } from "./strict.js";

export {
  applyChecked,
  applyCommandsSchema,
  BACKGROUND_TEMPLATE,
  defineTool,
  describeCommands,
  editorTools,
  toolsFromDefinitions,
} from "./tools.js";
export type { AssistantTool, EditorToolsOptions, ToolContext, ToolOutput } from "./tools.js";

export { commitFork, forkProject, withExplicitIds } from "./fork.js";
export type { CommitResult, ForkOptions, RecordingProject } from "./fork.js";

export { createAssistant, DEFAULT_INSTRUCTIONS } from "./run.js";

export { defineSkill, describeSkills, parseFrontMatter, parseSkill, skillsFromFiles, skillTools } from "./skills.js";
export type { AssistantSkill, SkillsFromFilesOptions } from "./skills.js";
export { MIRAICLIP_SKILLS } from "./skills.generated.js";
export type { Assistant, AssistantEvent, AssistantOptions, AssistantTurn, TurnOptions } from "./run.js";

export { scriptedChatModel } from "./testing.js";
export type { ScriptStep } from "./testing.js";
