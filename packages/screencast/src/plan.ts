/**
 * Everything at once, in the order that keeps each step correct: redactions
 * (in the clip's own frame), then zooms, then the overlays that must follow
 * the zooms (cursor, click ripples, callouts). Each step plans against the
 * project as the previous steps left it, on a scratch copy — your project is
 * not touched; dispatch the returned commands (as one undo step) to apply.
 */
import { applyCommands, createProject, type ProjectDocument } from "@miraiclip/core";
import type { CaptureSession } from "@miraiclip/capture";
import { planCallouts, type PlanCalloutsOptions } from "./callouts.js";
import { planClickEffects, type PlanClickEffectsOptions } from "./clicks.js";
import { planCursor, type PlanCursorOptions } from "./cursor.js";
import type { Command } from "./map.js";
import { planRedactions, type PlanRedactionsOptions } from "./redactions.js";
import { planZooms, type PlanZoomsOptions } from "./zooms.js";

type Step<T> = Omit<T, "clipId"> | false;

export interface PlanScreencastOptions {
  /** The screen recording's clip. */
  clipId: string;
  /** Each step's options, or `false` to skip it. All run by default except callouts. */
  redactions?: Step<PlanRedactionsOptions>;
  zooms?: Step<PlanZoomsOptions>;
  cursor?: Step<PlanCursorOptions>;
  clicks?: Step<PlanClickEffectsOptions>;
  callouts?: Step<PlanCalloutsOptions> | true;
}

export interface ScreencastPlan {
  commands: Command[];
  /** Commands per step, for UIs that let people accept them one by one. */
  steps: { redactions: Command[]; zooms: Command[]; cursor: Command[]; clicks: Command[]; callouts: Command[] };
  /** The project after the commands (a copy). */
  doc: ProjectDocument;
}

export function planScreencast(doc: ProjectDocument, session: CaptureSession, options: PlanScreencastOptions): ScreencastPlan {
  const scratch = createProject(structuredClone(doc), { historyLimit: 1 });
  const steps: ScreencastPlan["steps"] = { redactions: [], zooms: [], cursor: [], clicks: [], callouts: [] };
  const run = <T>(name: keyof ScreencastPlan["steps"], opts: Step<T> | true | undefined, enabledByDefault: boolean, plan: (d: ProjectDocument, o: T) => Command[]) => {
    if (opts === false || (opts === undefined && !enabledByDefault)) return;
    const o = { ...(opts === true || opts === undefined ? {} : opts), clipId: options.clipId } as T;
    const commands = plan(scratch.getState().doc, o);
    const result = applyCommands(scratch, commands);
    if (!result.ok) throw new Error(`screencast ${name} step produced an invalid command: ${JSON.stringify(result.error)}`);
    steps[name] = commands;
  };
  run<PlanRedactionsOptions>("redactions", options.redactions, true, (d, o) => planRedactions(d, session, o));
  run<PlanZoomsOptions>("zooms", options.zooms, true, (d, o) => planZooms(d, session, o));
  run<PlanCursorOptions>("cursor", options.cursor, true, (d, o) => planCursor(d, session, o));
  run<PlanClickEffectsOptions>("clicks", options.clicks, true, (d, o) => planClickEffects(d, session, o));
  run<PlanCalloutsOptions>("callouts", options.callouts, false, (d, o) => planCallouts(d, session, o));
  return {
    commands: [...steps.redactions, ...steps.zooms, ...steps.cursor, ...steps.clicks, ...steps.callouts],
    steps,
    doc: scratch.getState().doc,
  };
}
