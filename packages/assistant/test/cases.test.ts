/**
 * Every assistant case (evals/cases.ts), run with its reference solution
 * through a scripted model. This proves, without a key:
 * - the tools turn those calls into the right project (the check passes);
 * - the agent loop recovers from tool errors the solution scripts in;
 * - each request is one undo step that restores the starting project.
 * The live evals (pnpm eval) send the same prompts to a real model.
 */
import { describe, expect, it } from "vitest";
import { CASES } from "../evals/cases.js";
import { runCase } from "../evals/harness.js";
import { scriptedChatModel } from "../src/index.js";

describe(`assistant cases (scripted, ${CASES.length})`, () => {
  it("has 100+ uniquely named cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const { project, turn, before } = await runCase(c, scriptedChatModel(c.solution));
    expect(turn.status === "failed" ? turn.error : "ok").toBe("ok");
    c.check({ doc: project.getState().doc, before, turn });
    // One undo step back to where the request started.
    if (turn.status === "applied") {
      project.undo();
      expect(project.toJSON()).toEqual(before);
      expect(project.canUndo()).toBe(false);
    }
  });

  // The checks must be able to fail: doing nothing passes only where no edit is the right answer.
  it.each(CASES.filter((c) => !c.noEdit).map((c) => [c.id, c] as const))("%s: check rejects doing nothing", async (_id, c) => {
    const { project, turn, before } = await runCase(c, scriptedChatModel(["I'd rather not."]));
    expect(() => c.check({ doc: project.getState().doc, before, turn })).toThrow();
  });
});
