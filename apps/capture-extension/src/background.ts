import type { Message, RecorderCommand, ScreenKey } from "./messages.js";

/**
 * The background worker: opens the recorder on the current tab, shows a
 * recording badge on the toolbar button, relays the keyboard shortcuts, and
 * during a window or whole-screen recording relays every page's events to the
 * recorder tab.
 */

interface Active {
  tabId: number;
  windowId: number;
  surface: "browser" | "window" | "monitor";
  screen: ScreenKey;
  /** The recorder runs in the extension's own page (record.html), not in a website. */
  extensionPage: boolean;
}

// Service workers sleep; the recording's routing survives in session storage.
const KEY = "mc-active";
const TOKENS = "mc-tokens";
const load = async (): Promise<Active | undefined> => ((await chrome.storage.session.get(KEY))[KEY] as Active | undefined) ?? undefined;
const save = (a: Active | undefined) => (a ? chrome.storage.session.set({ [KEY]: a }) : chrome.storage.session.remove(KEY));

async function broadcast(message: Message) {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id !== undefined) chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
  }
}

/** Send to the recorder: a content script in a website, or the extension's own record page. */
function toRecorder(active: Active, message: Message) {
  if (active.extensionPage) chrome.runtime.sendMessage(message).catch(() => undefined);
  else chrome.tabs.sendMessage(active.tabId, message).catch(() => undefined);
}

// The toolbar badge: red REC while recording, grey while paused.
function badge(state: "rec" | "paused" | "off") {
  void chrome.action.setBadgeText({ text: state === "rec" ? "REC" : state === "paused" ? "❚❚" : "" });
  if (state !== "off") void chrome.action.setBadgeBackgroundColor({ color: state === "rec" ? "#e5484d" : "#6b6b76" });
  void chrome.action.setTitle({ title: state === "off" ? "Record with Miraiclip" : "Recording — Alt+Shift+X to finish" });
}

const recordPage = () => chrome.runtime.getURL("record.html");

// Clicking the toolbar button (or Alt+Shift+M) opens the recorder on the current tab. Pages
// that extensions can't touch (chrome://, the Web Store, a PDF) get the extension's own page.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  if (tab.url?.startsWith(recordPage())) return; // already there; its panel is open
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {
    void chrome.tabs.create({ url: recordPage(), ...(tab.index !== undefined ? { index: tab.index + 1 } : {}) });
  });
});

chrome.runtime.onMessage.addListener((message: Message, sender, reply) => {
  void (async () => {
    const active = await load();
    switch (message.type) {
      case "mc-start": {
        if (!sender.tab?.id || sender.tab.windowId === undefined) return;
        await save({
          tabId: sender.tab.id,
          windowId: sender.tab.windowId,
          surface: message.surface,
          screen: message.screen,
          extensionPage: !!sender.url?.startsWith(chrome.runtime.getURL("")),
        });
        badge("rec");
        // A tab recording logs in its own page; a window or screen needs every page.
        if (message.surface !== "browser") await broadcast({ type: "mc-log", on: true, surface: message.surface });
        return;
      }
      case "mc-stop":
        await save(undefined);
        badge("off");
        await broadcast({ type: "mc-log", on: false });
        return;
      case "mc-pause":
        if (active) badge(message.paused ? "paused" : "rec");
        return;
      case "mc-state":
        reply(active && active.surface !== "browser" ? ({ type: "mc-log", on: true, surface: active.surface } satisfies Message) : ({ type: "mc-log", on: false } satisfies Message));
        return;
      case "mc-event":
        if (!active || active.surface === "browser") return;
        // A window recording only shows its own window.
        if (active.surface === "window" && sender.tab?.windowId !== active.windowId) return;
        toRecorder(active, message);
        return;
      case "mc-token": {
        // Only a recorder in a tab may hand a recording to the save page.
        if (!sender.tab) return reply(undefined);
        const token = crypto.randomUUID();
        const tokens = ((await chrome.storage.session.get(TOKENS))[TOKENS] as string[] | undefined) ?? [];
        await chrome.storage.session.set({ [TOKENS]: [...tokens.slice(-9), token] });
        reply({ token });
        return;
      }
      case "mc-claim": {
        // Only the extension's own save page claims tokens.
        if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("bridge.html"))) return reply({ ok: false });
        const tokens = ((await chrome.storage.session.get(TOKENS))[TOKENS] as string[] | undefined) ?? [];
        const ok = tokens.includes(message.token);
        await chrome.storage.session.set({ [TOKENS]: tokens.filter((t) => t !== message.token) });
        reply({ ok });
        return;
      }
      case "mc-open-review": {
        const url = chrome.runtime.getURL(`review.html${message.id ? `#${message.id}` : ""}`);
        const at = sender.tab?.index !== undefined ? { index: sender.tab.index + 1 } : {};
        void chrome.tabs.create({ url, ...at });
        return;
      }
    }
  })();
  // Answer asynchronously.
  return message.type === "mc-state" || message.type === "mc-token" || message.type === "mc-claim";
});

// Another tab or window coming to the front: the page changed (ends blurs of the last one).
async function switched() {
  const active = await load();
  if (active && active.surface !== "browser") toRecorder(active, { type: "mc-switch", epochMs: Date.now() });
}
chrome.tabs.onActivated.addListener(() => void switched());
chrome.windows.onFocusChanged.addListener(() => void switched());

// The recorder's tab closing ends the recording with it: clear the badge and the loggers.
chrome.tabs.onRemoved.addListener((tabId) => {
  void load().then(async (active) => {
    if (active?.tabId !== tabId) return;
    await save(undefined);
    badge("off");
    await broadcast({ type: "mc-log", on: false });
  });
});

// Shortcuts that work from any tab: mark a step, pause or resume, draw, finish.
chrome.commands.onCommand.addListener((command) => {
  void load().then((active) => {
    if (!active) return;
    if (command === "mark-step") toRecorder(active, { type: "mc-step" });
    else if (command === "toggle-pause" || command === "stop-recording" || command === "toggle-draw") toRecorder(active, { type: "mc-command", command: command as RecorderCommand });
  });
});

// A worker that woke up after a browser restart: no recording survives that.
chrome.runtime.onStartup.addListener(() => badge("off"));
