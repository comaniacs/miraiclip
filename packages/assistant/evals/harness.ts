import type { Project } from "@miraiclip/core";
import { createAssistant, type AssistantTurn, type ChatModel } from "../src/index.js";
import type { EvalCase } from "./cases.js";
import { evalTools, fixture, S } from "./fixture.js";

export interface CaseRun {
  project: Project;
  turn: AssistantTurn;
  before: ReturnType<Project["toJSON"]>;
}

/** Build the case's project, run one request through the assistant, return the result. */
export async function runCase(c: EvalCase, model: ChatModel, options: { maxSteps?: number; signal?: AbortSignal } = {}): Promise<CaseRun> {
  const project = fixture();
  if (c.setup) {
    c.setup(project);
    project.clearHistory();
  }
  if (c.select) project.setSelection(c.select);
  if (c.playheadS !== undefined) project.setPlayhead(Math.round(c.playheadS * S));
  const before = structuredClone(project.toJSON());
  const assistant = createAssistant({ model, tools: evalTools(), ...(options.maxSteps ? { maxSteps: options.maxSteps } : {}) });
  const turn = await assistant.run(project, c.prompt, {
    ...(c.context ? { context: c.context } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return { project, turn, before };
}
