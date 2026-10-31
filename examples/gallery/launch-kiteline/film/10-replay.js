// ---- the real Kiteline app, replayed by the kit: every frame mounts the same core/views/ui code as app/ and performs
// the ACTIONS from timeline.mjs on its real elements (see _lib/app-film/browser/replay.js)
var winEl = $("win"), world = $("world");
var R = appReplay({ slot: $("appslot"), bar: BAR, actions: ACTIONS, mount: function (host) { KitelineUI.mount(host, { today: T.TODAY, storage: null }); } });
var host = null; // the current frame's app root, set by paint()
var layoutRect = R.rect;
