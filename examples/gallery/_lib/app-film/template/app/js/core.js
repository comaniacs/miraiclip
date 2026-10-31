/*
 * __TITLE__ core: the data model and the one reducer. Pure functions with no DOM, no clock and no randomness, so the
 * same actions always give the same state (the launch film relies on it) and the logic is testable in Node.
 * Replace the task model with your product's; keep the shape: initialState(opts) and reduce(state, action).
 */
(function (root) {
  "use strict";
  function set(o, patch) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in patch) r[k] = patch[k]; return r; }

  function initialState(opts) {
    opts = opts || {};
    return {
      draft: "",
      nextId: 4,
      items: opts.items || [
        { id: "i1", text: "Sketch the launch page", done: true },
        { id: "i2", text: "Write the announcement", done: false },
        { id: "i3", text: "Record the demo", done: false },
      ],
      toast: null,
    };
  }
  /** the one reducer: (state, action) → new state, never mutating */
  function reduce(s, a) {
    var t = s.toast ? set(s, { toast: null }) : s; // any action dismisses the last toast
    switch (a.type) {
      case "DRAFT": return set(t, { draft: a.value });
      case "ADD":
        if (!t.draft.trim()) return set(t, { toast: { kind: "error", text: "Write something first." } });
        return set(t, { items: t.items.concat([{ id: "i" + t.nextId, text: t.draft.trim(), done: false }]), nextId: t.nextId + 1, draft: "", toast: { kind: "ok", text: "Added." } });
      case "TOGGLE": return set(t, { items: t.items.map(function (it) { return it.id === a.id ? set(it, { done: !it.done }) : it; }) });
      case "DISMISS": return set(s, { toast: null });
      default: return t;
    }
  }
  function remaining(s) { return s.items.filter(function (it) { return !it.done; }).length; }

  var api = { initialState: initialState, reduce: reduce, remaining: remaining };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== "undefined" ? window : this);
