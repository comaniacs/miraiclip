import type { ZodError } from "zod";

/** The command's payload failed schema validation. State was not touched. */
export class CommandValidationError extends Error {
  readonly commandType: string;
  readonly issues: ZodError["issues"];

  constructor(commandType: string, error: ZodError) {
    super(
      `Invalid payload for "${commandType}": ${error.issues
        .map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`)
        .join("; ")}`,
    );
    this.name = "CommandValidationError";
    this.commandType = commandType;
    this.issues = error.issues;
  }
}

/**
 * The command was well-formed but cannot be applied to the current state
 * (unknown entity, track/clip kind mismatch, …). State was not touched.
 */
export class CommandRejectedError extends Error {
  readonly commandType: string;
  readonly code: string;

  constructor(commandType: string, code: string, message: string) {
    super(`Command "${commandType}" rejected (${code}): ${message}`);
    this.name = "CommandRejectedError";
    this.commandType = commandType;
    this.code = code;
  }
}

/** Dispatched a command type that is not registered. */
export class UnknownCommandError extends Error {
  readonly commandType: string;

  constructor(commandType: string) {
    super(`Unknown command type "${commandType}"`);
    this.name = "UnknownCommandError";
    this.commandType = commandType;
  }
}
