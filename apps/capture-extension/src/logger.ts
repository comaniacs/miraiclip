/**
 * Runs in every page. While a window or whole-screen recording is going on
 * (started from the recorder bar in any tab), it logs this page's clicks,
 * typing (never the characters), scrolls and private fields, moves them into
 * the recorded frame's coordinates, and sends them to the recorder.
 *
 * Nothing is logged at any other time.
 */
import { createEventLogger, eventToFrame, isSensitiveElement, pageInFrame, type DisplaySurface, type EventLogger } from "@miraiclip/capture";
import { epochMs, screenKey, type Message } from "./messages.js";

const BAR = "miraiclip-capture-bar";

// Tells pages the extension is here (the editor offers to install it otherwise). Only the version, nothing else.
document.documentElement.setAttribute("data-miraiclip-capture", chrome.runtime.getManifest().version);
let logger: EventLogger | undefined;

function start(surface: Exclude<DisplaySurface, "browser">) {
  if (logger) return;
  logger = createEventLogger({
    // Epoch microseconds: the recorder converts them to its own clock.
    now: () => Math.round(epochMs() * 1000),
    isSensitive: isSensitiveElement,
    ignore: (el) => el.closest(`#${BAR}`) !== null,
    onEvent: (event) => {
      // Resizes describe this page, not the frame; the recorder keeps the frame's size.
      if (event.type === "resize") return;
      // Where this page is in the frame right now (the window may have moved).
      const at = pageInFrame(surface, window);
      const message: Message = { type: "mc-event", event: eventToFrame(event, at), epochMs: event.tUs / 1000, screen: screenKey() };
      chrome.runtime.sendMessage(message).catch(() => undefined);
    },
  });
  logger.start();
}

function stop() {
  logger?.stop();
  logger = undefined;
}

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type !== "mc-log") return;
  if (message.on && message.surface) start(message.surface);
  else stop();
});

// A page opened or reloaded during a recording joins in.
chrome.runtime
  .sendMessage({ type: "mc-state" } satisfies Message)
  .then((reply?: Message) => {
    if (reply?.type === "mc-log" && reply.on && reply.surface) start(reply.surface);
  })
  .catch(() => undefined);
