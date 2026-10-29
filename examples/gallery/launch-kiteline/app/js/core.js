/*
 * Kiteline core: the post model, calendar dates, the state reducer and the demo AI generator. Pure functions with no
 * DOM, no clock and no randomness, so the same inputs always give the same state (the launch film relies on it), and
 * the logic is testable in Node.
 */
(function (root) {
  "use strict";

  var PLATFORMS = {
    linkedin: { id: "linkedin", name: "LinkedIn", limit: 3000, tag: "in" },
    instagram: { id: "instagram", name: "Instagram", limit: 2200, tag: "IG" },
    x: { id: "x", name: "X", limit: 280, tag: "X" },
  };
  var MEDIA = ["m1", "m2", "m3", "m4"];
  var AUDIENCES = {
    "team-leads": { label: "Team leads", line: "Team leads who run several meetings a day and own the follow-ups." },
    founders: { label: "Founders", line: "Founders of small companies who have no time to waste on tools." },
    creators: { label: "Creators", line: "Independent creators who work alone and plan their own week." },
    customers: { label: "Customers", line: "People who already use the product and want to get more from it." },
  };
  var TONES = {
    confident: { label: "Confident", line: "Confident and direct. Short sentences. No hype words." },
    friendly: { label: "Friendly", line: "Warm and conversational, like a note to a colleague." },
    playful: { label: "Playful", line: "Light and witty, one small joke at most." },
    expert: { label: "Expert", line: "Precise and practical, with one concrete example." },
  };
  var GOALS = {
    launch: { label: "Launch", line: "announce something new and get people to try it" },
    engage: { label: "Engage", line: "start a conversation and get replies" },
    educate: { label: "Educate", line: "teach one useful idea the reader can apply today" },
    convert: { label: "Convert", line: "move interested readers to one clear next step" },
  };
  var STRUCTURE = {
    linkedin: ["A one-line hook that names the reader's problem.", "Two sentences on why it matters now.", "Three short bullets on what is new.", "One clear call to action."],
    instagram: ["A hook inside the first 125 characters.", "Short lines with breathing room.", "One call to action.", "Three to five relevant hashtags at the end."],
    x: ["One idea, under 280 characters.", "Lead with the most surprising part.", "End with a short call to action."],
  };
  var HOOKS = ["Open by naming the problem in the reader's words.", "Open with a bold, specific statement.", "Open with a before-and-after moment."];

  // ---- dates: ISO strings (YYYY-MM-DD) handled in UTC so no time zone can shift a day
  function toDate(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function addMonths(s, n) { var d = toDate(s); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))); }
  function weekStart(s) { var d = toDate(s), dow = (d.getUTCDay() + 6) % 7; return addDays(s, -dow); } // weeks start on Monday
  function weekDays(s) { var a = weekStart(s), out = []; for (var i = 0; i < 7; i++) out.push(addDays(a, i)); return out; }
  /** the 6×7 month grid around s, Monday first */
  function monthGrid(s) {
    var first = s.slice(0, 8) + "01", a = weekStart(first), out = [];
    for (var i = 0; i < 42; i++) out.push(addDays(a, i));
    return out;
  }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function monthLabel(s) { var d = toDate(s); return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function dayLabel(s) { var d = toDate(s); return DAYS[d.getUTCDay()] + ", " + MONTHS[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate(); }
  function weekLabel(s) { var w = weekDays(s), a = toDate(w[0]), b = toDate(w[6]); return MONTHS[a.getUTCMonth()].slice(0, 3) + " " + a.getUTCDate() + " – " + (a.getUTCMonth() === b.getUTCMonth() ? "" : MONTHS[b.getUTCMonth()].slice(0, 3) + " ") + b.getUTCDate() + ", " + b.getUTCFullYear(); }
  function timeLabel(hm) { var h = +hm.slice(0, 2), m = hm.slice(3); return (h % 12 || 12) + ":" + m + (h < 12 ? " AM" : " PM"); }
  function sameMonth(a, b) { return a.slice(0, 7) === b.slice(0, 7); }

  /** characters as a reader counts them (code points, so an emoji is one) */
  function countChars(text) { return Array.from(text || "").length; }
  function titleOf(text) { var line = (text || "").split("\n")[0].trim(); return line.length > 60 ? line.slice(0, 57) + "…" : line || "Untitled post"; }

  // ---- the demo AI: a deterministic writer that builds a prompt and a draft from the user's own inputs
  function productName(idea) {
    var words = (idea || "").replace(/[^\w\s'-]/g, " ").split(/\s+/).filter(Boolean);
    for (var i = 1; i < words.length; i++) if (/^[A-Z][a-z]/.test(words[i])) return words[i];
    return "our new product";
  }
  function productKind(idea) { var m = /our new ([^,.;]+)/i.exec(idea || ""); return m ? m[1].trim() : "product"; }
  function generatePrompt(inp, variant) {
    var p = PLATFORMS[inp.platform], aud = AUDIENCES[inp.audience], tone = TONES[inp.tone], goal = GOALS[inp.goal];
    var kw = (inp.keywords || "").split(",").map(function (k) { return k.trim(); }).filter(Boolean);
    return [
      "TASK",
      "Write " + (/^[AEIOUX]/.test(p.name) ? "an " : "a ") + p.name + " post that will " + goal.line + ".",
      "",
      "TOPIC",
      (inp.idea || "").trim() + ".",
      "",
      "AUDIENCE",
      aud.line,
      "",
      "TONE",
      tone.line,
      "",
      "STRUCTURE",
      STRUCTURE[p.id].map(function (s, i) { return i + 1 + ". " + s; }).join("\n"),
      HOOKS[variant % HOOKS.length],
      "",
      "INCLUDE",
      kw.length ? kw.join(", ") : "The product name and one concrete benefit.",
      "",
      "AVOID",
      "Invented statistics, walls of emoji and vague superlatives. Stay under " + p.limit.toLocaleString("en-US") + " characters.",
    ].join("\n").replace(/\.\.$/m, ".");
  }
  function writeDraft(inp, variant) {
    var name = productName(inp.idea), kind = productKind(inp.idea), aud = AUDIENCES[inp.audience].label.toLowerCase();
    var hooks = ["Meet " + name + ", our new " + kind + ".", name + " is here.", "Before " + name + ": scattered notes. After: one clear place."];
    var hook = hooks[variant % hooks.length];
    if (inp.platform === "x") return hook + " Built for " + aud + " who want less busywork. Try it this week.";
    var body = [hook, "", "We built " + name + " for " + aud + " who want less busywork and more time for the work that matters.", ""];
    if (inp.platform === "linkedin") body.push("What you get:", "• Quick to set up", "• Easy to share with your team", "• Designed for the way " + aud + " work", "", "Try " + name + " this week and tell us what you think.");
    else body.push("Try it this week. Link in bio.", "", "#" + name.toLowerCase() + " #productivity #teamwork");
    return body.join("\n");
  }

  // ---- seed content: the Fieldnote launch month, relative to today
  function seedPosts(today) {
    var S = [
      [-11, "linkedin", "published", "16:00", "m3", "We're hiring a product designer who loves calm software.\n\nRemote within Europe. Link in comments."],
      [-7, "linkedin", "published", "09:00", "m1", "What we learned shipping 40 releases this year.\n\nThe short version: smaller, more often."],
      [-5, "instagram", "published", "18:30", "m2", "Behind the scenes at our team offsite.\n\nThree days, one whiteboard, zero slide decks."],
      [-3, "x", "published", "12:15", "m4", "Small change, big difference: shared notes now sync while you type."],
      [1, "instagram", "scheduled", "09:30", "m2", "Sneak peek: something new is coming Thursday.\n\nCan you guess what it is?"],
      [2, "x", "scheduled", "12:00", "m4", "Two days to go. We can't wait to show you."],
      [4, "linkedin", "scheduled", "08:45", "m3", "Webinar: running meetings people actually want to attend.\n\nFriday, 5 pm CET. Free to join."],
      [7, "instagram", "draft", "17:00", "m1", "Customer story: how a 12-person studio plans its week."],
      [8, "linkedin", "scheduled", "10:00", "m2", "Five agenda templates for your weekly one-on-ones."],
      [10, "x", "scheduled", "15:30", "m4", "Honest question: which meeting would you cancel forever?"],
      [11, "linkedin", "draft", "11:00", "m3", "Year-end product recap (outline)."],
      [15, "instagram", "scheduled", "11:00", "m1", "A thank-you note to everyone who sent us feedback this year."],
      [17, "x", "draft", "09:00", "m4", "Thread idea: what good meeting notes have in common."],
    ];
    return S.map(function (s, i) { return { id: "p" + (i + 1), date: addDays(today, s[0]), platform: s[1], status: s[2], time: s[3], media: s[4], text: s[5], prompt: null }; });
  }

  function initialState(opts) {
    opts = opts || {};
    var today = opts.today;
    return {
      today: today, view: "month", anchor: today, selected: today, page: "calendar",
      posts: opts.posts || seedPosts(today), nextId: 100,
      studio: { date: null, idea: "", platform: "instagram", audience: "customers", tone: "friendly", goal: "launch", keywords: "", prompt: "", variant: 0, copied: false },
      editing: null, toast: null,
    };
  }
  function postsOn(state, date) {
    return state.posts.filter(function (p) { return p.date === date; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
  }
  /** why a post can't be scheduled, or null */
  function scheduleProblem(state, post) {
    if (!post.text.trim()) return "Write something first.";
    if (countChars(post.text) > PLATFORMS[post.platform].limit) return "Too long for " + PLATFORMS[post.platform].name + ".";
    if (post.date < state.today) return "Pick today or a later date.";
    return null;
  }

  function set(o, patch) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in patch) r[k] = patch[k]; return r; }
  function upsert(posts, post) {
    var found = false, out = posts.map(function (p) { if (p.id === post.id) { found = true; return post; } return p; });
    return found ? out : out.concat([post]);
  }

  /** the one reducer: (state, action) → new state, never mutating */
  function reduce(s, a) {
    var t = s.toast ? set(s, { toast: null }) : s; // any action dismisses the last toast
    switch (a.type) {
      case "GO": return set(t, { page: a.page });
      case "SET_VIEW": return set(t, { view: a.view, anchor: t.selected || t.anchor });
      case "NAV": return set(t, { anchor: t.view === "month" ? addMonths(t.anchor, a.delta) : addDays(t.anchor, 7 * a.delta) });
      case "TODAY": return set(t, { anchor: t.today, selected: t.today });
      case "SELECT_DATE": return set(t, { selected: a.date });
      case "START_POST": return set(t, { page: "studio", selected: a.date, studio: set(t.studio, { date: a.date, prompt: "", copied: false }) });
      case "STUDIO_SET": var patch = {}; patch[a.field] = a.value; return set(t, { studio: set(t.studio, patch) });
      case "GENERATE": return (t.studio.idea || "").trim() ? set(t, { studio: set(t.studio, { prompt: generatePrompt(t.studio, t.studio.variant), copied: false }) }) : set(t, { toast: { kind: "error", text: "Describe your idea first." } });
      case "REGENERATE": var v = t.studio.variant + 1; return set(t, { studio: set(t.studio, { variant: v, prompt: generatePrompt(t.studio, v), copied: false }) });
      case "COPIED": return set(t, { studio: set(t.studio, { copied: true }), toast: { kind: "ok", text: "Prompt copied." } });
      case "WRITE_POST":
        if (!t.studio.prompt) return t;
        var st = t.studio;
        return set(t, {
          page: "editor", nextId: t.nextId + 1,
          editing: { id: "p" + t.nextId, isNew: true, date: st.date || t.selected || t.today, time: "10:00", platform: st.platform, status: "draft", media: "m1", text: writeDraft(st, st.variant), prompt: { idea: st.idea, audience: st.audience, tone: st.tone, goal: st.goal, keywords: st.keywords, text: st.prompt } },
        });
      case "OPEN_POST": var p = t.posts.filter(function (x) { return x.id === a.id; })[0]; return p ? set(t, { page: "editor", selected: p.date, editing: set(p, { isNew: false }) }) : t;
      case "NEW_BLANK": return set(t, { page: "editor", nextId: t.nextId + 1, editing: { id: "p" + t.nextId, isNew: true, date: t.selected || t.today, time: "10:00", platform: "linkedin", status: "draft", media: "m1", text: "", prompt: null } });
      case "EDIT": if (!t.editing) return t; var e = {}; e[a.field] = a.value; return set(t, { editing: set(t.editing, e) });
      case "SAVE_DRAFT":
        if (!t.editing) return t;
        var d = set(t.editing, { status: t.editing.status === "published" ? "published" : "draft", isNew: false });
        return set(t, { posts: upsert(t.posts, strip(d)), editing: d, toast: { kind: "ok", text: "Draft saved." } });
      case "SCHEDULE":
        if (!t.editing) return t;
        var why = scheduleProblem(t, t.editing);
        if (why) return set(t, { toast: { kind: "error", text: why } });
        var sp = strip(set(t.editing, { status: "scheduled" }));
        return set(t, { posts: upsert(t.posts, sp), editing: null, page: "calendar", selected: sp.date, anchor: sp.date, toast: { kind: "ok", text: "Scheduled for " + dayLabel(sp.date) + " at " + timeLabel(sp.time) + ".", post: sp.id } });
      case "DISMISS": return set(s, { toast: null });
      default: return t;
    }
  }
  function strip(p) { var r = set(p, {}); delete r.isNew; return r; }

  var api = {
    PLATFORMS: PLATFORMS, MEDIA: MEDIA, AUDIENCES: AUDIENCES, TONES: TONES, GOALS: GOALS,
    addDays: addDays, addMonths: addMonths, weekDays: weekDays, monthGrid: monthGrid, toDate: toDate, iso: iso,
    monthLabel: monthLabel, dayLabel: dayLabel, weekLabel: weekLabel, timeLabel: timeLabel, sameMonth: sameMonth,
    countChars: countChars, titleOf: titleOf, generatePrompt: generatePrompt, writeDraft: writeDraft, productName: productName,
    seedPosts: seedPosts, initialState: initialState, postsOn: postsOn, scheduleProblem: scheduleProblem, reduce: reduce,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KitelineCore = api;
})(typeof window !== "undefined" ? window : this);
