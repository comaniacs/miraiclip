import { describe, expect, it } from "vitest";
import { estimateViewportInVideo, fitResizedEvents, parseCaptureSession, type WindowGeometry } from "../src/index.js";

// A maximized 1920×1080 browser window on a 1920×1080 screen (Windows, 125 % scaling):
// 8 css px of toolbar-free border is not used by Chrome; 87 px of tabs and address bar on top.
const win: WindowGeometry = {
  innerWidth: 1920,
  innerHeight: 993,
  outerWidth: 1920,
  outerHeight: 1080,
  screenX: 0,
  screenY: 0,
  devicePixelRatio: 1.25,
  screen: { width: 1920, height: 1080, availLeft: 0, availTop: 0 },
};
const frame = { width: 2400, height: 1350 }; // device pixels

describe("estimateViewportInVideo", () => {
  it("a tab is the whole frame", () => {
    expect(estimateViewportInVideo("browser", frame, win)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("a window: the page sits below the toolbars", () => {
    const box = estimateViewportInVideo("window", frame, win)!;
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo(87 / 1080, 4);
    expect(box.width).toBe(1);
    expect(box.height).toBeCloseTo(993 / 1080, 4);
  });

  it("a whole screen: the window's position counts", () => {
    const small = { ...win, screenX: 200, screenY: 100, outerWidth: 1200, innerWidth: 1200, outerHeight: 800, innerHeight: 713 };
    const box = estimateViewportInVideo("monitor", frame, small)!;
    expect(box.x).toBeCloseTo(200 / 1920, 4);
    expect(box.y).toBeCloseTo((100 + 87) / 1080, 4);
    expect(box.width).toBeCloseTo(1200 / 1920, 4);
  });

  it("a frame that isn't this screen (another monitor) can't be placed", () => {
    expect(estimateViewportInVideo("monitor", { width: 3840, height: 2160 }, win)).toBeUndefined();
    expect(estimateViewportInVideo(undefined, frame, win)).toBeUndefined();
  });

  it("the session keeps what was recorded", () => {
    const s = parseCaptureSession({ format: 1, durationUs: 1, viewport: { width: 10, height: 10 }, surface: "monitor", events: [] });
    expect(s.surface).toBe("monitor");
  });
});

describe("pageInFrame / eventToFrame", () => {
  it("moves a page's events into the frame (a window not at the screen's corner)", async () => {
    const { pageInFrame, eventToFrame } = await import("../src/index.js");
    const w = { ...win, screenX: 200, screenY: 100, outerWidth: 1200, innerWidth: 1200, outerHeight: 800, innerHeight: 713 };
    const o = pageInFrame("monitor", w);
    expect(o).toMatchObject({ x: 200, y: 187, frameWidth: 1920, frameHeight: 1080 });
    const click = eventToFrame({ tUs: 1, type: "click", x: 10, y: 20, button: 0, target: { selector: "#a", tag: "button", rect: { x: 5, y: 15, width: 30, height: 10 } } }, o);
    expect(click).toMatchObject({ x: 210, y: 207, target: { rect: { x: 205, y: 202, width: 30 } } });
    expect(eventToFrame({ tUs: 2, type: "key", key: "Enter" }, o)).toEqual({ tUs: 2, type: "key", key: "Enter" });
  });
});

describe("fitResizedEvents", () => {
  const start = { width: 1280, height: 620 };
  const target = { selector: "#go", tag: "button", rect: { x: 100, y: 100, width: 200, height: 40 } };

  it("leaves events before any resize alone", () => {
    const events = [{ tUs: 1, type: "click" as const, x: 50, y: 60, button: 0, target }];
    expect(fitResizedEvents(events, start)).toEqual(events);
  });

  it("moves events after a resize to where the letterboxed video shows them", () => {
    // 1000×640 scaled into 1280×620: by 620/640, centred horizontally.
    const s = 620 / 640;
    const out = fitResizedEvents(
      [
        { tUs: 1, type: "resize", width: 1000, height: 640 },
        { tUs: 2, type: "click", x: 500, y: 320, button: 0, target },
      ],
      start,
    );
    const click = out[1] as { x: number; y: number; target: { rect: { x: number; width: number } } };
    const ox = (1280 - 1000 * s) / 2;
    expect(click.x).toBeCloseTo(ox + 500 * s, 0);
    expect(click.y).toBeCloseTo(320 * s, 0);
    expect(click.target.rect.x).toBeCloseTo(ox + 100 * s, 0);
    expect(click.target.rect.width).toBeCloseTo(200 * s, 0);
    expect(out[0]).toEqual({ tUs: 1, type: "resize", width: 1000, height: 640 });
  });

  it("scales without offsets for a zoom (same shape), and stops after resizing back", () => {
    const out = fitResizedEvents(
      [
        { tUs: 1, type: "resize", width: 1024, height: 496 },
        { tUs: 2, type: "move", x: 512, y: 248 },
        { tUs: 3, type: "resize", width: 1280, height: 620 },
        { tUs: 4, type: "move", x: 512, y: 248 },
      ],
      start,
    );
    expect(out[1]).toMatchObject({ x: 640, y: 310 });
    expect(out[3]).toMatchObject({ x: 512, y: 248 });
  });
});
