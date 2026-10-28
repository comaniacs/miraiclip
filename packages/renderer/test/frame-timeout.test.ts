import { describe, expect, it } from "vitest";
import { frameTimeoutMs } from "../src/html/scripted.js";

describe("frameTimeoutMs", () => {
  it("raises the default from data-frame-timeout, never lowers it, and caps it", () => {
    expect(frameTimeoutMs(`<div class="stage">`, 10_000)).toBe(10_000);
    expect(frameTimeoutMs(`<div class="stage" data-frame-timeout="120">`, 10_000)).toBe(120_000);
    expect(frameTimeoutMs(`<div data-frame-timeout="2">`, 10_000)).toBe(10_000);
    expect(frameTimeoutMs(`<div data-frame-timeout="99999">`, 10_000)).toBe(600_000);
  });
});
