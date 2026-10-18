/** The recorder's styles (inside its shadow root, so the page's CSS can't reach them). */
export const STYLES = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; }
[hidden] { display: none !important; }
.root {
  --bg: #121214; --bg-2: #1c1c20; --bg-3: #26262b; --line: rgba(255,255,255,.09); --line-2: rgba(255,255,255,.16);
  --text: #f5f5f6; --muted: #9d9da8; --accent: #7b6cff; --accent-soft: rgba(123,108,255,.18); --rec: #ff3d4a; --ok: #3ddc97;
  font: 13px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--text);
  -webkit-font-smoothing: antialiased; letter-spacing: .005em;
}
button { all: unset; cursor: pointer; box-sizing: border-box; }
button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
svg { display: block; flex: none; }

/* ── Setup panel ─────────────────────────────── */
.panel {
  position: fixed; top: 16px; right: 16px; width: 316px; pointer-events: auto;
  background: var(--bg); border: 1px solid var(--line); border-radius: 18px; padding: 14px;
  box-shadow: 0 24px 60px -12px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.35);
  display: flex; flex-direction: column; gap: 12px; animation: pop .18s ease-out;
}
@keyframes pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } }
.head { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
.logo { width: 22px; height: 22px; border-radius: 7px; background: linear-gradient(135deg, #8f7dff, #5b48e8); display: grid; place-items: center; }
.logo::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #fff; }
.icon-btn { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--muted); }
.icon-btn:hover { background: var(--bg-3); color: var(--text); }

.seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--bg-2); padding: 4px; border-radius: 12px; }
.seg button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 9px 4px 8px; border-radius: 9px; color: var(--muted); font-size: 11.5px; font-weight: 500; text-align: center; }
.seg button:hover { color: var(--text); }
.seg button[aria-pressed="true"] { background: var(--bg-3); color: var(--text); box-shadow: inset 0 0 0 1px var(--line-2); }

.label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin: 0 2px 6px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tiles button { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 6px; border-radius: 10px; border: 1px solid var(--line); color: var(--muted); font-size: 12px; font-weight: 500; }
.tiles button:hover { border-color: var(--line-2); color: var(--text); }
.tiles button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
.tiles svg { width: 15px; height: 15px; }

.device { position: relative; display: flex; align-items: center; gap: 8px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; height: 38px; overflow: hidden; }
.device:hover { border-color: var(--line-2); }
.device > svg { color: var(--muted); width: 16px; height: 16px; }
.device.off > svg { color: var(--rec); }
.device select { all: unset; flex: 1; min-width: 0; align-self: stretch; line-height: 36px; cursor: pointer; font-size: 12.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 18px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239d9da8' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 2px center; }
.device option { background: #1c1c20; color: #f5f5f6; }
.meter { position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: transparent; }
.meter i { display: block; height: 100%; width: 0; background: var(--ok); transition: width .08s linear; }

.options { border-top: 1px solid var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 12.5px; cursor: pointer; }
.toggle:hover { color: var(--text); }
.switch { width: 30px; height: 18px; border-radius: 99px; background: var(--bg-3); position: relative; transition: background .15s; flex: none; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
.toggle[aria-checked="true"] .switch { background: var(--accent); }
.toggle[aria-checked="true"] .switch::after { transform: translateX(12px); }

.note { font-size: 12px; color: #ffb4b9; background: rgba(255,61,74,.1); border: 1px solid rgba(255,61,74,.25); padding: 8px 10px; border-radius: 10px; }
.start { display: flex; align-items: center; justify-content: center; gap: 9px; height: 44px; border-radius: 12px; background: var(--rec); color: #fff; font-weight: 600; font-size: 14px; transition: filter .12s, transform .06s; }
.start:hover { filter: brightness(1.08); }
.start:active { transform: scale(.985); }
.start[disabled] { opacity: .5; pointer-events: none; }
.start .dot { width: 10px; height: 10px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.3); }
.foot { display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-size: 11.5px; }
.link { display: flex; align-items: center; gap: 4px; color: var(--muted); }
.link:hover { color: var(--text); }
.link svg { width: 14px; height: 14px; }
kbd { font: 10.5px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg-3); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 1px 4px; color: var(--text); }

/* ── Camera bubble ───────────────────────────── */
.bubble { position: fixed; pointer-events: auto; border-radius: 50%; touch-action: none; cursor: grab; filter: drop-shadow(0 10px 24px rgba(0,0,0,.45)); transition: width .18s ease, height .18s ease; }
.bubble.dragging { cursor: grabbing; transition: none; }
.bubble video { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: #222; display: block; }
.bubble.mirror video { transform: scaleX(-1); }
.bubble-tools { position: absolute; left: 50%; bottom: -14px; transform: translateX(-50%); display: flex; gap: 2px; background: var(--bg); border: 1px solid var(--line); border-radius: 99px; padding: 3px; opacity: 0; transition: opacity .15s; }
.bubble:hover .bubble-tools, .bubble:focus-within .bubble-tools { opacity: 1; }
.bubble-tools button { height: 24px; min-width: 24px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center; color: var(--muted); font-size: 11px; font-weight: 600; }
.bubble-tools button:hover { background: var(--bg-3); color: var(--text); }
.bubble-tools button[aria-pressed="true"] { color: var(--text); background: var(--bg-3); }
.bubble-tools svg { width: 14px; height: 14px; }
.bubble.popped { width: 120px !important; height: 40px !important; border-radius: 99px; background: var(--bg); display: grid; place-items: center; color: var(--muted); font-size: 11.5px; }
.bubble.popped video { display: none; }

/* ── Countdown ───────────────────────────────── */
.countdown { position: fixed; inset: 0; pointer-events: auto; display: grid; place-items: center; background: rgba(8,8,10,.55); backdrop-filter: blur(2px); cursor: pointer; animation: fade .15s ease-out; }
@keyframes fade { from { opacity: 0; } }
.count-wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.ring { width: 148px; height: 148px; border-radius: 50%; display: grid; place-items: center; background: rgba(18,18,20,.92); box-shadow: 0 0 0 1px var(--line-2), 0 30px 80px rgba(0,0,0,.5); font-size: 64px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ring span { animation: tick 1s ease-out both; }
@keyframes tick { 0% { transform: scale(1.35); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 85% { opacity: 1; } 100% { opacity: .2; transform: scale(.92); } }
.count-hint { color: rgba(255,255,255,.75); font-size: 12.5px; background: rgba(18,18,20,.8); padding: 6px 12px; border-radius: 99px; }

/* ── Control pill ────────────────────────────── */
.pill { position: fixed; left: 20px; bottom: 24px; pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; background: var(--bg); border: 1px solid var(--line); border-radius: 99px; box-shadow: 0 16px 40px rgba(0,0,0,.45); animation: pop .18s ease-out; }
.pill > button { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--muted); position: relative; }
.pill > button:hover { background: var(--bg-3); color: var(--text); }
.pill > button.stop { background: var(--rec); color: #fff; }
.pill > button.stop:hover { background: var(--rec); filter: brightness(1.1); }
.pill > button.stop i { width: 13px; height: 13px; border-radius: 3px; background: #fff; }
.pill > button[aria-pressed="true"] { color: var(--rec); }
.pill .time { font: 600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text); padding: 2px 0 4px; font-variant-numeric: tabular-nums; }
.pill.paused .time { color: var(--muted); animation: blink 1.2s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.pill .sep { width: 20px; height: 1px; background: var(--line); margin: 2px 0; }
.pill .badge { position: absolute; top: 3px; right: 2px; min-width: 15px; height: 15px; border-radius: 99px; background: var(--accent); color: #fff; font-size: 9.5px; font-weight: 700; display: grid; place-items: center; padding: 0 3px; }
.pill .badge:empty { display: none; }
.pill > button[data-tip]:hover::after { content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%); white-space: nowrap; background: var(--bg); border: 1px solid var(--line); color: var(--text); font-size: 11.5px; font-weight: 500; padding: 5px 8px; border-radius: 8px; pointer-events: none; }
.confirm { position: absolute; left: calc(100% + 10px); bottom: 0; width: 240px; background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 12px; box-shadow: 0 16px 40px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 10px; animation: pop .14s ease-out; }
.confirm b { font-size: 13px; }
.confirm p { color: var(--muted); font-size: 12px; }
.confirm .row { display: flex; gap: 6px; justify-content: flex-end; }
.confirm .row button { padding: 7px 11px; border-radius: 9px; font-size: 12px; font-weight: 600; background: var(--bg-3); }
.confirm .row button.danger { background: var(--rec); color: #fff; }
.flash { position: fixed; pointer-events: none; background: var(--accent); color: #fff; font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 99px; animation: flash 1.2s ease-out forwards; }
@keyframes flash { 0% { opacity: 0; transform: translateX(-6px); } 15%, 75% { opacity: 1; transform: none; } 100% { opacity: 0; } }

/* ── Drawing ─────────────────────────────────── */
.bubble { z-index: 1; }
.draw-layer { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: auto; z-index: 2; touch-action: none; }
.pill, .flash { z-index: 3; }
.panel, .countdown, .toast { z-index: 4; }
.draw-palette { position: fixed; z-index: 3; pointer-events: auto; display: flex; align-items: center; gap: 2px; padding: 5px; background: var(--bg); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,.45); animation: pop .14s ease-out; }
.draw-palette button { position: relative; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; color: var(--muted); }
.draw-palette button:hover { background: var(--bg-3); color: var(--text); }
.draw-palette button[aria-pressed="true"] { background: var(--accent-soft); color: var(--text); box-shadow: inset 0 0 0 1px var(--accent); }
.draw-palette .swatch { width: 26px; height: 26px; }
.draw-palette .swatch::after { content: ""; width: 14px; height: 14px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
.draw-palette .swatch[aria-pressed="true"] { background: none; box-shadow: none; }
.draw-palette .swatch[aria-pressed="true"]::after { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--c); }
.draw-palette .dsep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
.draw-palette button[data-tip]:hover::after { content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); white-space: nowrap; background: var(--bg); border: 1px solid var(--line); color: var(--text); font-size: 11.5px; font-weight: 500; padding: 5px 8px; border-radius: 8px; pointer-events: none; }

/* ── Saving ──────────────────────────────────── */
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); pointer-events: auto; display: flex; align-items: center; gap: 10px; background: var(--bg); border: 1px solid var(--line); border-radius: 99px; padding: 10px 16px; box-shadow: 0 16px 40px rgba(0,0,0,.45); font-weight: 500; }
.spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--text); animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.frame { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0; left: -10px; top: -10px; }
`;
