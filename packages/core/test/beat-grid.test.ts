import { describe, expect, it } from "vitest";
import { applyBeatGrid } from "../src/index.js";

const tpl = '<div class="stage" data-libs="stage" data-duration="8" data-stage-version="2"><div class="world"></div></div><script>stage.build(()=>{})</script>';

describe("applyBeatGrid", () => {
  it("writes beats and downbeats on the stage root, shifted by the offset, dropping earlier ones", () => {
    const r = applyBeatGrid(tpl, { beats: [0.4, 0.9, 1.4, 1.9], downbeats: [0.4, 1.9] }, 0.5);
    expect(r).toMatchObject({ found: true, beats: 3, downbeats: 1 });
    expect(r.template).toContain(`data-beats='[0.4,0.9,1.4]'`);
    expect(r.template).toContain(`data-downbeats='[1.4]'`);
    expect(r.template).toContain("<script>stage.build");
  });

  it("replaces an existing grid instead of adding a second", () => {
    const once = applyBeatGrid(tpl, { beats: [1, 2] }).template;
    const twice = applyBeatGrid(once, { beats: [3, 4] }).template;
    expect(twice.match(/data-beats/g)).toHaveLength(1);
    expect(twice).toContain("[3,4]");
  });

  it("reports a template with no stage root", () => {
    expect(applyBeatGrid("<p>x</p>", { beats: [1] })).toMatchObject({ found: false, template: "<p>x</p>" });
  });
});
