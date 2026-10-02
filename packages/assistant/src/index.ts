export type {
  ChatMessage,
  ChatModel,
  ChatModelInfo,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ChatUsage,
  FetchLike,
  ToolCall,
  ToolSpec,
} from "./types.js";
export { ChatModelError, defineChatModel } from "./types.js";

export { openAIChatModel, toOpenAIMessages, parseToolArguments, retryDelayMs } from "./openai.js";
export type { OpenAIChatModelOptions } from "./openai.js";

export { createChatHandler, remoteChatModel } from "./http.js";
export { rateLimitedChatModel } from "./limits.js";
export type { RateLimitOptions } from "./limits.js";
export type { ChatHandlerOptions, RemoteChatModelOptions } from "./http.js";

export { describeForAssistant } from "./state.js";
export { unknownFields } from "./strict.js";
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
export type { Assistant, AssistantEvent, AssistantOptions, AssistantTurn, TurnOptions } from "./run.js";

export { scriptedChatModel } from "./testing.js";
export type { ScriptStep } from "./testing.js";
