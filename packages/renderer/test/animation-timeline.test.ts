import { describe, expect, it } from "vitest";
import { buildAnimationTimeline, type AnimationDescriptor } from "../src/html/animation-timeline.js";

const kf = (offset: number, values: Record<string, string>, easing = "linear") => ({ offset, easing, values });

const flyIn: AnimationDescriptor = {
  // 1 s fly-in starting at 0.5 s, then holds (fill both) until the clip ends
  delayS: 0.5,
  durationS: 1,
  iterations: 1,
  direction: "normal",
  keyframes: [kf(0, { opacity: "0" }), kf(1, { opacity: "1" })],
};

describe("html animation timeline", () => {
  it("no animations: one constant span forever", () => {
    const t = buildAnimationTimeline([])!;
    expect(t.constantSpanAt(0)).toEqual(t.constantSpanAt(100));
  });

  it("a fly-in: constant before, changing during, constant after", () => {
    const t = buildAnimationTimeline([flyIn])!;
    expect(t.constantSpanAt(0.2)!.sinceS).toBe(t.constantSpanAt(0.4)!.sinceS);
    expect(t.constantSpanAt(1)).toBeUndefined();
    const after = t.constantSpanAt(1.6)!;
    expect(after.sinceS).toBeCloseTo(1.5);
    expect(t.constantSpanAt(7)!.sinceS).toBe(after.sinceS);
  });

  it("hold segments between moves keep one span", () => {
    const t = buildAnimationTimeline([
      {
        delayS: 0,
        durationS: 10,
        iterations: 1,
        direction: "normal",
        keyframes: [kf(0, { x: "0" }), kf(0.1, { x: "5" }), kf(0.5, { x: "5" }), kf(0.6, { x: "9" }), kf(1, { x: "9" })],
      },
    ])!;
    expect(t.constantSpanAt(0.5)).toBeUndefined(); // moving 0..1 s
    expect(t.constantSpanAt(2)!.sinceS).toBeCloseTo(1);
    expect(t.constantSpanAt(4.9)!.sinceS).toBeCloseTo(1);
    expect(t.constantSpanAt(5.5)).toBeUndefined(); // moving 5..6 s
    expect(t.constantSpanAt(9)!.sinceS).toBeCloseTo(6);
  });

  it("steps() counters change only at their steps, also when infinite", () => {
    const t = buildAnimationTimeline([
      {
        delayS: 0,
        durationS: 10,
        iterations: Infinity,
        direction: "normal",
        keyframes: [kf(0, { transform: "translateY(0)" }, "steps(10, end)"), kf(1, { transform: "translateY(-10em)" })],
      },
    ])!;
    expect(t.constantSpanAt(3.2)!.sinceS).toBeCloseTo(3);
    expect(t.constantSpanAt(3.9)!.sinceS).toBeCloseTo(3);
    expect(t.constantSpanAt(4.1)!.sinceS).toBeCloseTo(4);
    // next iteration wraps
    expect(t.constantSpanAt(10.5)!.sinceS).toBeCloseTo(10);
    expect(t.constantSpanAt(123.45)!.sinceS).toBeCloseTo(123);
  });

  it("several animations: the latest change wins, any continuous one means changing", () => {
    const counter: AnimationDescriptor = {
      delayS: 0,
      durationS: 2,
      iterations: Infinity,
      direction: "normal",
      keyframes: [kf(0, { y: "0" }, "steps(2, end)"), kf(1, { y: "2" })],
    };
    const t = buildAnimationTimeline([flyIn, counter])!;
    expect(t.constantSpanAt(1)).toBeUndefined(); // fly-in moving
    expect(t.constantSpanAt(3.5)!.sinceS).toBeCloseTo(3); // counter stepped at 3 s, fly-in done at 1.5 s
    expect(t.constantSpanAt(2.2)!.sinceS).toBeCloseTo(2);
  });

  it("alternate direction mirrors the moving part", () => {
    const t = buildAnimationTimeline([
      {
        delayS: 0,
        durationS: 4,
        iterations: 2,
        direction: "alternate",
        keyframes: [kf(0, { x: "0" }), kf(0.25, { x: "1" }), kf(1, { x: "1" })],
      },
    ])!;
    expect(t.constantSpanAt(0.5)).toBeUndefined(); // forward: moves 0..1 s
    expect(t.constantSpanAt(3)!.sinceS).toBeCloseTo(1);
    // reversed iteration (4..8 s): holds 4..7, moves 7..8
    expect(t.constantSpanAt(5)!.sinceS).toBeCloseTo(4);
    expect(t.constantSpanAt(7.5)).toBeUndefined();
    expect(t.constantSpanAt(9)!.sinceS).toBeCloseTo(8); // finished
  });

  it("keyframes naming different properties are not analysed", () => {
    expect(
      buildAnimationTimeline([
        { delayS: 0, durationS: 1, iterations: 1, direction: "normal", keyframes: [kf(0, { x: "0" }), kf(1, { y: "1" })] },
      ]),
    ).toBeUndefined();
  });
});
