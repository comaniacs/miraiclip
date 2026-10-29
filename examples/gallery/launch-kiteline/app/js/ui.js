/*
 * Kiteline UI: mounts the app into an element, turns clicks and inputs into reducer actions and re-renders.
 *
 *   KitelineUI.mount(el, { today, storage, autoDismiss, clipboard }) → { dispatch, getState, el }
 *
 * storage: { load() → saved | null, save(saved) } or null for an in-memory session (the launch film uses null).
 * Typing into a text field updates state without re-rendering the field, so the caret and selection survive; the
 * caption also patches the live preview and the character count in place.
 */
(function (root) {
  "use strict";
  var K = root.KitelineCore, Vw = root.KitelineViews;

  function mount(el, opts) {
    opts = opts || {};
    var ctx = { storageOk: true }, state = K.initialState({ today: opts.today });
    if (opts.storage) {
      try {
        var saved = opts.storage.load();
        if (saved && Array.isArray(saved.posts)) state = Object.assign({}, state, { posts: saved.posts, nextId: saved.nextId || state.nextId });
      } catch (err) {
        ctx.storageOk = false; // unreadable or blocked storage: run in memory and say so in the sidebar
      }
    }
    var timer = null;
    el.classList.add("kl-app");

    function persist() {
      if (!opts.storage || !ctx.storageOk) return;
      try { opts.storage.save({ posts: state.posts, nextId: state.nextId }); } catch (err) { ctx.storageOk = false; }
    }
    function render() {
      el.innerHTML = Vw.app(state, ctx);
      if (opts.autoDismiss && state.toast) {
        clearTimeout(timer);
        timer = setTimeout(function () { dispatch({ type: "DISMISS" }); }, 3200);
      }
    }
    function patchEditor() {
      var p = state.editing, c = Vw.countInfo(p, state);
      var t = el.querySelector(".kl-pv-text");
      if (t) t.innerHTML = (p.platform === "instagram" ? "<b>fieldnote.app</b> " : "") + Vw.richText(p.text || " ");
      var n = el.querySelector(".kl-count");
      n.classList.toggle("over", c.over);
      n.firstChild.textContent = c.n.toLocaleString("en-US") + " / " + c.lim.toLocaleString("en-US");
      el.querySelector(".kl-why").textContent = c.why || "";
      el.querySelector('[data-act="schedule"]').disabled = !!c.why;
      el.querySelector(".kl-head h1").textContent = K.titleOf(p.text);
    }
    function dispatch(action, quiet) {
      var prev = state;
      state = K.reduce(state, action);
      if (state.posts !== prev.posts) persist();
      if (!quiet) render();
      return state;
    }

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || !el.contains(b) || b.disabled) return;
      var d = b.dataset;
      switch (d.act) {
        case "go": return dispatch({ type: "GO", page: d.page });
        case "view": return dispatch({ type: "SET_VIEW", view: d.view });
        case "nav": return dispatch({ type: "NAV", delta: +d.delta });
        case "today": return dispatch({ type: "TODAY" });
        case "select": return dispatch({ type: "SELECT_DATE", date: d.date });
        case "start": return dispatch({ type: "START_POST", date: d.date });
        case "studio": return dispatch({ type: "STUDIO_SET", field: d.field, value: d.value });
        case "generate": return dispatch({ type: "GENERATE" });
        case "regenerate": return dispatch({ type: "REGENERATE" });
        case "copy": return copyPrompt();
        case "write": return dispatch({ type: "WRITE_POST" });
        case "open": return dispatch({ type: "OPEN_POST", id: d.post });
        case "new": return dispatch({ type: "NEW_BLANK" });
        case "edit": return dispatch({ type: "EDIT", field: d.field, value: d.value });
        case "save": return dispatch({ type: "SAVE_DRAFT" });
        case "schedule": return dispatch({ type: "SCHEDULE" });
        case "back": return dispatch({ type: "GO", page: "calendar" });
        case "dismiss": return dispatch({ type: "DISMISS" });
        default: return undefined;
      }
    });
    el.addEventListener("input", function (e) {
      var f = e.target.dataset && e.target.dataset.field;
      if (!f) return;
      if (f === "idea" || f === "keywords" || f === "prompt") dispatch({ type: "STUDIO_SET", field: f, value: e.target.value }, true);
      else if (f === "text") { dispatch({ type: "EDIT", field: "text", value: e.target.value }, true); patchEditor(); }
    });
    el.addEventListener("change", function (e) {
      var f = e.target.dataset && e.target.dataset.field;
      if ((f === "date" || f === "time") && e.target.value) dispatch({ type: "EDIT", field: f, value: e.target.value });
    });

    function copyPrompt() {
      var text = state.studio.prompt, clip = opts.clipboard || (root.navigator && root.navigator.clipboard);
      if (!clip || !clip.writeText) { state = Object.assign({}, state, { toast: { kind: "error", text: "Copy isn't available here. Select the text instead." } }); render(); return; }
      clip.writeText(text).then(function () { dispatch({ type: "COPIED" }); }, function () {
        state = Object.assign({}, state, { toast: { kind: "error", text: "Copy was blocked by the browser." } });
        render();
      });
    }

    render();
    return { dispatch: dispatch, getState: function () { return state; }, el: el };
  }

  root.KitelineUI = { mount: mount };
})(typeof window !== "undefined" ? window : this);
