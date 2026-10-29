// Standalone boot: today's real date, posts saved in localStorage, toasts dismiss themselves.
// ?today=YYYY-MM-DD pins the date (the end-to-end test and the film use 2026-11-09); ?reset clears saved posts.
(function () {
  "use strict";
  var KEY = "kiteline.v1", q = new URLSearchParams(location.search);
  var pinned = /^\d{4}-\d{2}-\d{2}$/.test(q.get("today") || "") ? q.get("today") : null;
  var d = new Date(), local = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  var storage = {
    load: function () {
      if (q.has("reset")) localStorage.removeItem(KEY);
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    },
    save: function (data) { localStorage.setItem(KEY, JSON.stringify(data)); },
  };
  window.kiteline = KitelineUI.mount(document.getElementById("app"), { today: pinned || local, storage: storage, autoDismiss: true });
})();
