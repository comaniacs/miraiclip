/*
 * __TITLE__ UI: mount(el, opts) renders the app into el and turns clicks and inputs into reducer actions.
 *   AppUI.mount(el, { storage }) → { dispatch, getState, el }
 * The film calls mount() once per frame with storage: null. Contract the kit relies on:
 * - every clickable element carries data-act (what a click does); every input carries data-field
 * - typing updates state without re-rendering the field, so the caret survives
 * - all user text goes through esc()
 */
(function (root) {
  "use strict";
  var C = root.AppCore;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function view(s, ctx) {
    var items = s.items.map(function (it) {
      return '<li class="ap-item' + (it.done ? " done" : "") + '"><button class="ap-check" data-act="toggle" data-id="' + esc(it.id) + '" aria-label="' + (it.done ? "Mark not done" : "Mark done") + '"></button><span>' + esc(it.text) + "</span></li>";
    }).join("");
    var toast = s.toast ? '<div class="ap-toast on ' + s.toast.kind + '" role="status"><span>' + esc(s.toast.text) + '</span><button data-act="dismiss" aria-label="Dismiss">×</button></div>' : '<div class="ap-toast"></div>';
    return '<aside class="ap-side"><div class="ap-brand"><span class="ap-mark"></span>__TITLE__</div>' + (ctx.storageOk ? "" : '<em class="ap-warn">Changes won\'t be saved in this browser.</em>') + "</aside>" +
      '<main class="ap-main"><header class="ap-head"><small>Today</small><h1>' + C.remaining(s) + " to go</h1></header>" +
      '<div class="ap-add"><input class="ap-input" data-field="draft" placeholder="Add a task" value="' + esc(s.draft) + '"><button class="ap-btn" data-act="add">Add</button></div>' +
      '<ul class="ap-list">' + items + "</ul></main>" + toast;
  }

  function mount(el, opts) {
    opts = opts || {};
    var ctx = { storageOk: true }, state = C.initialState();
    if (opts.storage) {
      try { var saved = opts.storage.load(); if (saved && Array.isArray(saved.items)) state = Object.assign({}, state, saved); }
      catch (err) { ctx.storageOk = false; } // unreadable or blocked storage: run in memory and say so
    }
    el.classList.add("ap-app");
    function render() { el.innerHTML = view(state, ctx); }
    function dispatch(action, quiet) {
      var prev = state;
      state = C.reduce(state, action);
      if (opts.storage && ctx.storageOk && state.items !== prev.items) {
        try { opts.storage.save({ items: state.items, nextId: state.nextId }); } catch (err) { ctx.storageOk = false; }
      }
      if (!quiet) render();
      return state;
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || !el.contains(b)) return;
      if (b.dataset.act === "add") dispatch({ type: "ADD" });
      else if (b.dataset.act === "toggle") dispatch({ type: "TOGGLE", id: b.dataset.id });
      else if (b.dataset.act === "dismiss") dispatch({ type: "DISMISS" });
    });
    el.addEventListener("input", function (e) { if (e.target.dataset.field === "draft") dispatch({ type: "DRAFT", value: e.target.value }, true); });
    render();
    return { dispatch: dispatch, getState: function () { return state; }, el: el };
  }
  root.AppUI = { mount: mount };
})(typeof window !== "undefined" ? window : this);
