// Unit tests for the Kiteline core: dates, the reducer workflow, validation and the demo generator.
//   node --test app/test/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const K = createRequire(import.meta.url)("../js/core.js");

const TODAY = "2026-11-09"; // a Monday
const run = (state, ...actions) => actions.reduce((s, a) => K.reduce(s, a), state);
const fresh = () => K.initialState({ today: TODAY });
const IDEA = "Introduce Fieldnote, our new meeting-notes app";

test("month grid starts on the Monday before the 1st and spans six weeks", () => {
  const g = K.monthGrid("2026-11-20");
  assert.equal(g.length, 42);
  assert.equal(g[0], "2026-10-26");
  assert.equal(g[6], "2026-11-01");
  assert.equal(g[41], "2026-12-06");
});

test("week days run Monday to Sunday, across a month boundary", () => {
  assert.deepEqual(K.weekDays("2026-12-02"), ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
});

test("labels", () => {
  assert.equal(K.dayLabel("2026-11-12"), "Thu, Nov 12");
  assert.equal(K.monthLabel("2026-11-12"), "November 2026");
  assert.equal(K.weekLabel("2026-11-12"), "Nov 9 – 15, 2026");
  assert.equal(K.weekLabel("2026-12-02"), "Nov 30 – Dec 6, 2026");
  assert.equal(K.timeLabel("10:00"), "10:00 AM");
  assert.equal(K.timeLabel("15:30"), "3:30 PM");
});

test("navigation moves by month in month view and by week in week view", () => {
  let s = run(fresh(), { type: "NAV", delta: 1 });
  assert.equal(s.anchor, "2026-12-01");
  s = run(fresh(), { type: "SET_VIEW", view: "week" }, { type: "NAV", delta: -1 });
  assert.equal(s.anchor, "2026-11-02");
  s = run(s, { type: "TODAY" });
  assert.equal(s.anchor, TODAY);
});

test("switching view keeps the selected date in view", () => {
  const s = run(fresh(), { type: "SELECT_DATE", date: "2026-11-26" }, { type: "SET_VIEW", view: "week" });
  assert.ok(K.weekDays(s.anchor).includes("2026-11-26"));
});

test("the prompt is built from every input", () => {
  const p = K.generatePrompt({ idea: IDEA, platform: "linkedin", audience: "team-leads", tone: "confident", goal: "launch", keywords: "async, follow-ups" }, 0);
  assert.match(p, /Write a LinkedIn post that will announce something new/);
  assert.match(p, /Introduce Fieldnote, our new meeting-notes app\./);
  assert.match(p, /Team leads who run several meetings/);
  assert.match(p, /Confident and direct/);
  assert.match(p, /async, follow-ups/);
  assert.match(p, /under 3,000 characters/);
  const x = K.generatePrompt({ idea: IDEA, platform: "x", audience: "founders", tone: "playful", goal: "engage", keywords: "" }, 0);
  assert.match(x, /Write an X post/);
  assert.match(K.generatePrompt({ idea: IDEA, platform: "instagram", audience: "founders", tone: "playful", goal: "engage", keywords: "" }, 0), /Write an Instagram post/);
  assert.match(x, /under 280 characters/);
  assert.match(x, /Founders of small companies/);
});

test("regenerate changes the prompt deterministically", () => {
  const s0 = run(fresh(), { type: "STUDIO_SET", field: "idea", value: IDEA }, { type: "GENERATE" });
  const s1 = run(s0, { type: "REGENERATE" });
  assert.notEqual(s0.studio.prompt, s1.studio.prompt);
  assert.equal(run(s0, { type: "REGENERATE" }).studio.prompt, s1.studio.prompt);
});

test("generate refuses an empty idea with an error toast", () => {
  const s = run(fresh(), { type: "GENERATE" });
  assert.equal(s.studio.prompt, "");
  assert.equal(s.toast.kind, "error");
});

test("the full workflow: date → prompt → draft → edit → schedule → calendar", () => {
  let s = run(fresh(), { type: "SET_VIEW", view: "week" }, { type: "SELECT_DATE", date: "2026-11-12" }, { type: "START_POST", date: "2026-11-12" });
  assert.equal(s.page, "studio");
  assert.equal(s.studio.date, "2026-11-12");
  s = run(s, { type: "STUDIO_SET", field: "idea", value: IDEA }, { type: "STUDIO_SET", field: "platform", value: "linkedin" },
    { type: "STUDIO_SET", field: "audience", value: "team-leads" }, { type: "STUDIO_SET", field: "tone", value: "confident" }, { type: "GENERATE" });
  assert.match(s.studio.prompt, /LinkedIn/);
  s = run(s, { type: "WRITE_POST" });
  assert.equal(s.page, "editor");
  assert.equal(s.editing.date, "2026-11-12");
  assert.equal(s.editing.platform, "linkedin");
  assert.match(s.editing.text, /^Meet Fieldnote, our new meeting-notes app\./);
  assert.equal(s.editing.prompt.idea, IDEA);
  const edited = s.editing.text.replace("Meet Fieldnote, our new meeting-notes app.", "Your meetings deserve better notes. Meet Fieldnote.");
  s = run(s, { type: "EDIT", field: "text", value: edited }, { type: "EDIT", field: "media", value: "m2" }, { type: "SCHEDULE" });
  assert.equal(s.page, "calendar");
  assert.equal(s.selected, "2026-11-12");
  assert.equal(s.toast.text, "Scheduled for Thu, Nov 12 at 10:00 AM.");
  const onDay = K.postsOn(s, "2026-11-12");
  assert.equal(onDay.length, 1);
  assert.equal(onDay[0].status, "scheduled");
  assert.equal(onDay[0].media, "m2");
  assert.match(onDay[0].text, /^Your meetings deserve better notes\./);
  assert.equal(onDay[0].isNew, undefined);
  // reopening it edits the same post instead of making a copy
  s = run(s, { type: "OPEN_POST", id: onDay[0].id }, { type: "EDIT", field: "time", value: "11:30" }, { type: "SAVE_DRAFT" });
  assert.equal(K.postsOn(s, "2026-11-12").length, 1);
  assert.equal(K.postsOn(s, "2026-11-12")[0].status, "draft");
  assert.equal(K.postsOn(s, "2026-11-12")[0].time, "11:30");
});

test("schedule validates length, emptiness and past dates", () => {
  let s = run(fresh(), { type: "NEW_BLANK" }, { type: "SCHEDULE" });
  assert.equal(s.toast.text, "Write something first.");
  s = run(s, { type: "EDIT", field: "platform", value: "x" }, { type: "EDIT", field: "text", value: "a".repeat(281) }, { type: "SCHEDULE" });
  assert.equal(s.toast.text, "Too long for X.");
  assert.equal(s.page, "editor");
  s = run(s, { type: "EDIT", field: "text", value: "ok" }, { type: "EDIT", field: "date", value: "2026-11-01" }, { type: "SCHEDULE" });
  assert.equal(s.toast.text, "Pick today or a later date.");
});

test("the reducer never mutates its input", () => {
  const s = fresh(), snapshot = JSON.stringify(s);
  run(s, { type: "STUDIO_SET", field: "idea", value: IDEA }, { type: "GENERATE" }, { type: "WRITE_POST" }, { type: "SCHEDULE" });
  assert.equal(JSON.stringify(s), snapshot);
});

test("character counts treat an emoji as one character", () => {
  assert.equal(K.countChars("hi 👋"), 4);
});

test("seed posts tell the launch-week story around today", () => {
  const s = fresh();
  assert.equal(K.postsOn(s, "2026-11-12").length, 0, "launch day starts empty");
  assert.equal(K.postsOn(s, "2026-11-10")[0].status, "scheduled");
  assert.ok(s.posts.filter((p) => p.date < TODAY).every((p) => p.status === "published"));
});
