/*
 * Kiteline views: state → HTML strings. Every user-supplied string goes through esc(). Interactive elements carry
 * data-act (what a click does) or data-field (what an input edits); ui.js turns those into reducer actions.
 */
(function (root) {
  "use strict";
  var K = root.KitelineCore;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function attr(o) { var out = ""; for (var k in o) out += " " + k + '="' + esc(o[k]) + '"'; return out; }
  /** post text for a preview: escaped, line breaks kept, hashtags tinted, the first line wrapped so it can be pointed at */
  function richText(text) {
    var lines = esc(text).split("\n").map(function (l) { return l.replace(/(^|\s)(#[\w-]+)/g, '$1<span class="kl-tag">$2</span>'); });
    if (lines.length) lines[0] = '<span class="kl-l1">' + lines[0] + "</span>";
    return lines.join("<br>");
  }
  var ICON = {
    cal: '<svg viewBox="0 0 20 20"><rect x="3" y="4.5" width="14" height="12" rx="2.5"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4"/></svg>',
    spark: '<svg viewBox="0 0 20 20"><path d="M10 2.5l1.7 4.6 4.8 1.4-4.8 1.6L10 15l-1.7-4.9-4.8-1.6 4.8-1.4z"/><path d="M15.5 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>',
    pen: '<svg viewBox="0 0 20 20"><path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 013 3L8 15z"/><path d="M12 5l3 3"/></svg>',
    left: '<svg viewBox="0 0 20 20"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>',
    right: '<svg viewBox="0 0 20 20"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg>',
    plus: '<svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',
    copy: '<svg viewBox="0 0 20 20"><rect x="6.5" y="6.5" width="10" height="10" rx="2"/><path d="M13.5 6.5V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v7A1.5 1.5 0 005 13.5h1.5"/></svg>',
    redo: '<svg viewBox="0 0 20 20"><path d="M15.5 9a5.5 5.5 0 10-1.6 4.4"/><path d="M15.8 4.5V9h-4.5"/></svg>',
    check: '<svg viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    clock: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M10 6v4.3l2.8 1.8"/></svg>',
  };
  var STATUS = { draft: "Draft", scheduled: "Scheduled", published: "Published" };
  function pf(platform) { return '<i class="kl-pf p-' + platform + '">' + K.PLATFORMS[platform].tag + "</i>"; }
  function pill(status) { return '<span class="kl-pill s-' + status + '">' + (status === "published" ? ICON.check : "") + STATUS[status] + "</span>"; }
  function shortTime(hm) { return K.timeLabel(hm).replace(":00", "").replace(" AM", "a").replace(" PM", "p"); }

  // ---- shell
  function sidebar(s, ctx) {
    var nav = [["calendar", "Calendar", ICON.cal], ["studio", "Prompt studio", ICON.spark], ["editor", "Editor", ICON.pen]];
    return '<aside class="kl-side"><div class="kl-brand"><span class="kl-mark"><i></i></span>Kiteline</div>' +
      '<div class="kl-ws"><span class="kl-ws-av">F</span><div><b>Fieldnote</b><small>Marketing workspace</small></div></div><nav>' +
      nav.map(function (n) { return '<button class="kl-nav' + (s.page === n[0] ? " on" : "") + '"' + attr({ "data-act": "go", "data-page": n[0] }) + ">" + n[2] + n[1] + "</button>"; }).join("") +
      '</nav><div class="kl-demo"><b>Demo mode</b>AI runs in your browser. Nothing is posted to social networks.' + (ctx.storageOk ? "" : "<em>Changes won't be saved in this browser.</em>") + "</div></aside>";
  }
  function toast(s) {
    if (!s.toast) return '<div class="kl-toast"></div>';
    return '<div class="kl-toast on ' + s.toast.kind + '" role="status">' + (s.toast.kind === "ok" ? ICON.check : "") + "<span>" + esc(s.toast.text) + '</span><button data-act="dismiss" aria-label="Dismiss">×</button></div>';
  }

  // ---- calendar
  function chip(p) {
    return '<button class="kl-chip s-' + p.status + '"' + attr({ "data-act": "open", "data-post": p.id, title: K.titleOf(p.text) }) + ">" + pf(p.platform) + "<b>" + shortTime(p.time) + "</b><span>" + esc(K.titleOf(p.text)) + "</span></button>";
  }
  function month(s) {
    var head = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) { return "<span>" + d + "</span>"; }).join("");
    var cells = K.monthGrid(s.anchor).map(function (d) {
      var ps = K.postsOn(s, d), cls = "kl-cell" + (K.sameMonth(d, s.anchor) ? "" : " out") + (d === s.selected ? " sel" : "") + (d === s.today ? " today" : "") + (d < s.today ? " past" : "");
      var list = ps.slice(0, 3).map(chip).join("") + (ps.length > 3 ? '<span class="kl-more">+' + (ps.length - 3) + " more</span>" : "");
      return '<div class="' + cls + '"' + attr({ "data-act": "select", "data-date": d }) + '><span class="kl-num">' + +d.slice(8) + "</span>" + list + "</div>";
    }).join("");
    return '<div class="kl-month"><div class="kl-dow">' + head + '</div><div class="kl-grid">' + cells + "</div></div>";
  }
  function postCard(p) {
    return '<button class="kl-card s-' + p.status + '"' + attr({ "data-act": "open", "data-post": p.id }) + '><div class="kl-card-top">' + pf(p.platform) + "<b>" + K.timeLabel(p.time) + "</b></div><p>" + esc(K.titleOf(p.text)) + "</p>" + pill(p.status) + "</button>";
  }
  function week(s) {
    return '<div class="kl-week">' + K.weekDays(s.anchor).map(function (d) {
      var dt = K.toDate(d), ps = K.postsOn(s, d);
      var head = '<button class="kl-wh' + (d === s.selected ? " sel" : "") + (d === s.today ? " today" : "") + '"' + attr({ "data-act": "select", "data-date": d }) + "><span>" + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()] + "</span><b>" + dt.getUTCDate() + "</b></button>";
      var body = ps.map(postCard).join("") + (d >= s.today ? '<button class="kl-add"' + attr({ "data-act": "start", "data-date": d, "aria-label": "Add post on " + K.dayLabel(d) }) + ">" + ICON.plus + "</button>" : "");
      return '<div class="kl-col' + (d === s.selected ? " sel" : "") + (d < s.today ? " past" : "") + '"' + attr({ "data-date": d }) + ">" + head + '<div class="kl-col-body">' + body + "</div></div>";
    }).join("") + "</div>";
  }
  function dayPanel(s) {
    var d = s.selected, ps = K.postsOn(s, d), canAdd = d >= s.today;
    var body = ps.length ? ps.map(postCard).join("") : '<div class="kl-empty"><span class="kl-empty-art"><i></i><i></i><i></i></span><b>Nothing planned yet.</b><small>' + (canAdd ? "Start from an idea and let Kiteline draft it." : "This day has passed.") + "</small></div>";
    var btn = canAdd ? '<button class="kl-btn primary wide"' + attr({ "data-act": "start", "data-date": d }) + ">" + ICON.plus + (ps.length ? "Add another post" : "Create post for " + K.dayLabel(d)) + "</button>" : "";
    return '<section class="kl-day"><header><small>Selected day</small><h3>' + K.dayLabel(d) + "</h3><span>" + ps.length + (ps.length === 1 ? " post" : " posts") + '</span></header><div class="kl-day-list">' + body + "</div>" + btn + "</section>";
  }
  function calendar(s) {
    var label = s.view === "month" ? K.monthLabel(s.anchor) : K.weekLabel(s.anchor);
    return '<header class="kl-head"><div><small>Content calendar</small><h1>' + label + '</h1></div><div class="kl-tools">' +
      '<div class="kl-seg">' + ["month", "week"].map(function (v) { return '<button class="' + (s.view === v ? "on" : "") + '"' + attr({ "data-act": "view", "data-view": v }) + ">" + (v === "month" ? "Month" : "Week") + "</button>"; }).join("") + "</div>" +
      '<div class="kl-navbtns"><button class="kl-icon"' + attr({ "data-act": "nav", "data-delta": -1, "aria-label": "Previous" }) + ">" + ICON.left + '</button><button class="kl-btn ghost" data-act="today">Today</button><button class="kl-icon"' + attr({ "data-act": "nav", "data-delta": 1, "aria-label": "Next" }) + ">" + ICON.right + "</button></div>" +
      '<button class="kl-btn primary"' + attr({ "data-act": "start", "data-date": s.selected >= s.today ? s.selected : s.today }) + ">" + ICON.plus + "New post</button></div></header>" +
      '<div class="kl-cal">' + (s.view === "month" ? month(s) : week(s)) + dayPanel(s) + "</div>";
  }

  // ---- prompt studio
  function chips(field, options, value) {
    return '<div class="kl-chips">' + Object.keys(options).map(function (k) { return '<button class="kl-opt' + (value === k ? " on" : "") + '"' + attr({ "data-act": "studio", "data-field": field, "data-value": k }) + ">" + esc(options[k].label || options[k].name) + "</button>"; }).join("") + "</div>";
  }
  function studio(s) {
    var st = s.studio, date = st.date || s.selected;
    var out = st.prompt
      ? '<textarea class="kl-prompt" data-field="prompt" spellcheck="false">' + esc(st.prompt) + '</textarea><div class="kl-out-act"><button class="kl-btn ghost" data-act="copy">' + (st.copied ? ICON.check + "Copied" : ICON.copy + "Copy") + '</button><button class="kl-btn ghost" data-act="regenerate">' + ICON.redo + 'Regenerate</button><button class="kl-btn primary" data-act="write">' + ICON.pen + "Write post from prompt</button></div>"
      : '<div class="kl-empty big"><span class="kl-empty-art ai"><i></i><i></i><i></i></span><b>Your prompt will appear here.</b><small>Describe the idea, pick who it is for, then generate.</small></div>';
    return '<header class="kl-head"><div><small>Prompt studio</small><h1>Turn an idea into a brief</h1></div><div class="kl-tools"><span class="kl-date">' + ICON.cal + "For " + K.dayLabel(date) + '</span><span class="kl-ai-badge">' + ICON.spark + "Demo AI · runs in your browser</span></div></header>" +
      '<div class="kl-studio"><section class="kl-panel kl-form">' +
      '<label class="kl-lbl">Your idea</label><textarea class="kl-idea" data-field="idea" rows="3" placeholder="e.g. Announce our new feature to existing customers">' + esc(st.idea) + "</textarea>" +
      '<label class="kl-lbl">Platform</label>' + chips("platform", K.PLATFORMS, st.platform) +
      '<label class="kl-lbl">Audience</label>' + chips("audience", K.AUDIENCES, st.audience) +
      '<label class="kl-lbl">Tone</label>' + chips("tone", K.TONES, st.tone) +
      '<label class="kl-lbl">Goal</label>' + chips("goal", K.GOALS, st.goal) +
      '<label class="kl-lbl">Keywords <small>optional, comma separated</small></label><input class="kl-input" data-field="keywords" value="' + esc(st.keywords) + '" placeholder="e.g. async, follow-ups">' +
      '<button class="kl-btn ai wide" data-act="generate">' + ICON.spark + "Generate prompt</button></section>" +
      '<section class="kl-panel kl-out' + (st.prompt ? " has" : "") + '"><header><b>Generated prompt</b><small>' + (st.prompt ? "Editable · " + K.PLATFORMS[st.platform].name + " · " + K.AUDIENCES[st.audience].label + " · " + K.TONES[st.tone].label : "Waiting for your idea") + "</small></header>" + out + "</section></div>";
  }

  // ---- editor and previews
  function preview(p) {
    var media = '<div class="kl-media ' + p.media + '"><b>Meet<br>Fieldnote</b><i></i></div>', text = richText(p.text || " ");
    if (p.platform === "instagram") return '<div class="kl-pv ig"><div class="kl-pv-h"><span class="kl-av">F</span><b>fieldnote.app</b></div>' + media + '<div class="kl-pv-acts"><i></i><i></i><i></i></div><p class="kl-pv-text"><b>fieldnote.app</b> ' + text + "</p></div>";
    if (p.platform === "x") return '<div class="kl-pv x"><span class="kl-av">F</span><div><div class="kl-pv-h"><b>Fieldnote</b><small>@fieldnote · now</small></div><p class="kl-pv-text">' + text + "</p>" + media + "</div></div>";
    return '<div class="kl-pv li"><div class="kl-pv-h"><span class="kl-av sq">F</span><div><b>Fieldnote</b><small>Company page · Now</small></div></div><p class="kl-pv-text">' + text + "</p>" + media + '<div class="kl-pv-bar"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div></div>';
  }
  function countInfo(p, s) {
    var n = K.countChars(p.text), lim = K.PLATFORMS[p.platform].limit;
    return { n: n, lim: lim, over: n > lim, why: K.scheduleProblem(s, p) };
  }
  function editor(s) {
    var p = s.editing;
    if (!p) return '<header class="kl-head"><div><small>Editor</small><h1>Nothing open</h1></div></header><div class="kl-empty big"><b>Open a post from the calendar, or start a new one.</b><button class="kl-btn primary" data-act="new">' + ICON.plus + "New blank post</button></div>";
    var c = countInfo(p, s);
    return '<header class="kl-head"><div><small>Editor · ' + (p.isNew ? "New post" : STATUS[p.status]) + "</small><h1>" + esc(K.titleOf(p.text)) + '</h1></div><div class="kl-tools"><button class="kl-btn ghost" data-act="back">' + ICON.left + "Back to calendar</button></div></header>" +
      '<div class="kl-editor"><section class="kl-panel kl-edit">' +
      '<div class="kl-tabs">' + Object.keys(K.PLATFORMS).map(function (k) { return '<button class="' + (p.platform === k ? "on" : "") + '"' + attr({ "data-act": "edit", "data-field": "platform", "data-value": k }) + ">" + pf(k) + K.PLATFORMS[k].name + "</button>"; }).join("") + "</div>" +
      '<label class="kl-lbl">Caption ' + (p.prompt ? '<small class="kl-from">' + ICON.spark + "Drafted from your prompt</small>" : "") + '</label><textarea class="kl-caption" data-field="text" spellcheck="false">' + esc(p.text) + '</textarea><div class="kl-count' + (c.over ? " over" : "") + '"><span class="kl-count-n">' + c.n.toLocaleString("en-US") + " / " + c.lim.toLocaleString("en-US") + "</span></div>" +
      '<label class="kl-lbl">Media</label><div class="kl-thumbs">' + K.MEDIA.map(function (m) { return '<button class="kl-thumb ' + m + (p.media === m ? " on" : "") + '"' + attr({ "data-act": "edit", "data-field": "media", "data-value": m, "aria-label": "Media " + m.slice(1) }) + "><i></i></button>"; }).join("") + "</div>" +
      '<div class="kl-when"><label class="kl-lbl">Date<input type="date" class="kl-input" data-field="date" value="' + p.date + '"></label><label class="kl-lbl">Time<input type="time" class="kl-input" data-field="time" value="' + p.time + '"></label></div>' +
      '<div class="kl-edit-act"><span class="kl-why">' + esc(c.why || "") + '</span><button class="kl-btn ghost" data-act="save">Save draft</button><button class="kl-btn primary" data-act="schedule"' + (c.why ? " disabled" : "") + ">" + ICON.clock + "Schedule</button></div></section>" +
      '<section class="kl-preview"><header><b>Preview</b><small>' + K.PLATFORMS[p.platform].name + " · approximate layout</small></header>" + preview(p) + "</section></div>";
  }

  function app(s, ctx) {
    var page = s.page === "studio" ? studio(s) : s.page === "editor" ? editor(s) : calendar(s);
    return sidebar(s, ctx) + '<main class="kl-main kl-page-' + s.page + '">' + page + "</main>" + toast(s);
  }

  root.KitelineViews = { app: app, preview: preview, countInfo: countInfo, esc: esc, richText: richText };
})(typeof window !== "undefined" ? window : this);
