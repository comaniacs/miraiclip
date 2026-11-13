import { describe, expect, it, vi } from "vitest";
import { Emitter, createProject } from "@miraiclip/core";
import type { Player, PlayerEvents } from "../src/player.js";
import { createPreviewController, type MonitoredAudioOutput } from "../src/preview/preview-controller.js";
import { FakeBackend } from "./scene-fakes.js";
import { FakeOutput } from "./audio-fakes.js";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function projectWithClip(durationUs = 4_000_000) {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "t1", trackId: "v1", startUs: 0, durationUs, text: "hi" },
    });
  });
  return project;
}

class FakePlayer {
  events = new Emitter<PlayerEvents>();
  playing = false;
  rate = 1;
  timeUs = 0;
  durationUs = 4_000_000;
  destroyed = false;
  pressure = 0;
  seeks: number[] = [];
  on<K extends keyof PlayerEvents>(type: K, listener: (event: PlayerEvents[K]) => void) {
    return this.events.on(type, listener);
  }
  play() {
    if (this.playing) return;
    this.playing = true;
    this.events.emit("play", { timeUs: this.timeUs });
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.events.emit("pause", { timeUs: this.timeUs, reason: "pause" });
  }
  seek(us: number) {
    this.timeUs = us;
    this.seeks.push(us);
  }
  loop = false;
  setRate(rate: number) {
    this.rate = rate;
  }
  setLoop(loop: boolean) {
    this.loop = loop;
  }
  getClipBounds(clipId: string) {
    return clipId === "t1" ? ({ x: 1, y: 2, width: 3, height: 4 } as never) : null;
  }
  hitTest() {
    return "t1";
  }
  stats() {
    return {} as never;
  }
  reportMemoryPressure() {
    this.pressure++;
  }
  destroy() {
    this.destroyed = true;
  }
}

function fakeCanvas() {
  const listeners = new Map<string, () => void>();
  return {
    canvas: {
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as HTMLCanvasElement,
    fire: (type: string) => listeners.get(type)?.(),
    has: (type: string) => listeners.has(type),
  };
}

function setup(overrides: { supported?: boolean; failBackend?: boolean } = {}) {
  const project = projectWithClip();
  const frames: ((ts: number) => void)[] = [];
  const players: FakePlayer[] = [];
  const backends: FakeBackend[] = [];
  const outputSizes: [number, number][] = [];
  const gains: number[] = [];
  let resolveBackend: (() => void) | undefined;
  const controller = createPreviewController(project, {
    isSupported: () => overrides.supported ?? true,
    devicePixelRatio: () => 2,
    raf: (cb) => frames.push(cb),
    cancelRaf: (handle) => {
      frames[handle - 1] = () => undefined;
    },
    createBackend: () =>
      new Promise((resolve, reject) => {
        resolveBackend = () => {
          if (overrides.failBackend) return reject(new Error("no webgl"));
          const backend = new FakeBackend();
          (backend as unknown as { setOutputSize: (w: number, h: number) => void }).setOutputSize = (w, h) =>
            outputSizes.push([w, h]);
          backends.push(backend);
          resolve(backend);
        };
      }),
    createPlayer: (_project, playerOptions) => {
      const player = new FakePlayer();
      player.loop = playerOptions.loop ?? false;
      player.rate = playerOptions.rate ?? 1;
      players.push(player);
      return player as unknown as Player;
    },
    createAudioOutput: (gain): MonitoredAudioOutput => {
      gains.push(gain);
      return { output: new FakeOutput(), setGain: (g) => gains.push(g) };
    },
  });
  const step = (ts: number) => frames.splice(0).forEach((cb) => cb(ts));
  return {
    project,
    controller,
    players,
    backends,
    outputSizes,
    gains,
    step,
    buildBackend: async () => {
      resolveBackend?.();
      await flush();
    },
  };
}

describe("createPreviewController", () => {
  it("starts in fallback mode and moves the playhead with its own clock", () => {
    const { project, controller, step } = setup();
    expect(controller.getState().mode).toBe("fallback");
    controller.play();
    expect(controller.getState().playing).toBe(true);
    step(0);
    step(1000); // 1s later
    expect(project.getState().playheadUs).toBe(1_000_000);
    step(5000); // past the 4s end
    expect(project.getState().playheadUs).toBe(4_000_000);
    expect(controller.getState().playing).toBe(false);
  });

  it("reports unsupported browsers and never builds a renderer there", () => {
    const { controller, players } = setup({ supported: false });
    expect(controller.getState().mode).toBe("unsupported");
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    expect(players).toHaveLength(0);
    expect(controller.getState().mode).toBe("unsupported");
  });

  it("goes live on attach, sizes the render target by DPR, and follows player events", async () => {
    const { controller, players, outputSizes, buildBackend } = setup();
    const { canvas } = fakeCanvas();
    controller.attach(canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(controller.getState().mode).toBe("live");
    const states: boolean[] = [];
    controller.subscribe(() => states.push(controller.getState().playing));
    expect(outputSizes.at(-1)).toEqual([1280, 720]);
    controller.play();
    expect(controller.getState().playing).toBe(true);
    players[0]!.pause(); // the player stops on its own (end of composition)
    expect(controller.getState().playing).toBe(false);
    expect(states).toEqual([true, false]);
    controller.resize(800, 450);
    expect(outputSizes.at(-1)).toEqual([1600, 900]);
  });

  it("builds one renderer for StrictMode's attach → detach → attach on the same canvas", async () => {
    const { controller, players, backends, buildBackend } = setup();
    const { canvas } = fakeCanvas();
    controller.attach(canvas, { width: 640, height: 360 });
    controller.detach();
    controller.attach(canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(backends).toHaveLength(1);
    expect(players).toHaveLength(1);
    expect(controller.getState().mode).toBe("live");
  });

  it("destroys a backend that finished building after detach", async () => {
    const { controller, players, backends, buildBackend } = setup();
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    controller.detach();
    await buildBackend();
    expect(backends[0]!.destroyed).toBe(true);
    expect(players).toHaveLength(0);
    expect(controller.getState().mode).toBe("fallback");
  });

  it("falls back with the error text when the backend fails", async () => {
    const { controller, buildBackend } = setup({ failBackend: true });
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(controller.getState()).toMatchObject({ mode: "fallback", lastError: "no webgl" });
  });

  it("clamps seeks to the composition and routes them to the live player", async () => {
    const { project, controller, players, buildBackend } = setup();
    controller.seek(-5);
    expect(project.getState().playheadUs).toBe(0);
    controller.seek(9_000_000);
    expect(project.getState().playheadUs).toBe(4_000_000);
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    await buildBackend();
    controller.seek(1_234_567.4);
    expect(players[0]!.seeks.at(-1)).toBe(1_234_567);
  });

  it("drives the monitoring gain from volume and mute", async () => {
    const { controller, gains, buildBackend } = setup();
    controller.setVolume(0.4);
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(gains[0]).toBe(0.4); // built at the current level
    controller.toggleMute();
    expect(gains.at(-1)).toBe(0);
    controller.toggleMute();
    expect(gains.at(-1)).toBe(0.4);
    controller.setVolume(0);
    expect(controller.getState().muted).toBe(true);
    controller.toggleMute(); // unmuting from zero restores an audible level
    expect(controller.getState()).toMatchObject({ muted: false, volume: 0.5 });
  });

  it("reports GPU context loss as memory pressure and removes the listener on detach", async () => {
    const { controller, players, buildBackend } = setup();
    const canvas = fakeCanvas();
    controller.attach(canvas.canvas, { width: 640, height: 360 });
    await buildBackend();
    canvas.fire("webglcontextlost");
    expect(players[0]!.pressure).toBe(1);
    controller.detach();
    expect(canvas.has("webglcontextlost")).toBe(false);
    expect(players[0]!.destroyed).toBe(true);
  });

  it("runs beforeLive and onPlayerReady, and keeps two controllers independent", async () => {
    const order: string[] = [];
    const project = projectWithClip();
    const make = () =>
      createPreviewController(project, {
        isSupported: () => true,
        devicePixelRatio: () => 1,
        createBackend: async () => new FakeBackend(),
        createPlayer: () => new FakePlayer() as unknown as Player,
        createAudioOutput: () => ({ output: new FakeOutput(), setGain: () => undefined }),
        beforeLive: async () => {
          order.push("beforeLive");
        },
        onPlayerReady: () => order.push("ready"),
      });
    const a = make();
    const b = make();
    a.attach(fakeCanvas().canvas, { width: 100, height: 100 });
    await flush();
    await flush();
    expect(order).toEqual(["beforeLive", "ready"]);
    expect(a.getState().mode).toBe("live");
    expect(b.getState().mode).toBe("fallback");
    const listener = vi.fn();
    a.subscribe(listener);
    a.destroy();
    a.setVolume(0.2);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("preview controller loop and rate", () => {
  it("keeps loop and rate across a player rebuild and forwards changes to the live player", async () => {
    const { controller, players, buildBackend } = setup();
    const a = fakeCanvas();
    controller.setLoop(true);
    controller.setRate(1.5);
    expect(controller.getState()).toMatchObject({ loop: true, rate: 1.5 });
    controller.attach(a.canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(players[0]).toMatchObject({ loop: true, rate: 1.5 }); // built with them
    controller.setRate(2);
    controller.setLoop(false);
    expect(players[0]).toMatchObject({ loop: false, rate: 2 });
    controller.detach();
    const b = fakeCanvas();
    controller.attach(b.canvas, { width: 640, height: 360 });
    await buildBackend();
    expect(players[1]).toMatchObject({ loop: false, rate: 2 });
    controller.setRate(0); // not a speed
    controller.setRate(Number.NaN);
    expect(controller.getState().rate).toBe(2);
  });

  it("follows a rate or loop change made on the player itself", async () => {
    const { controller, players, buildBackend } = setup();
    controller.attach(fakeCanvas().canvas, { width: 640, height: 360 });
    await buildBackend();
    players[0]!.events.emit("ratechange", { rate: 0.5 });
    players[0]!.events.emit("loopchange", { loop: true });
    expect(controller.getState()).toMatchObject({ rate: 0.5, loop: true });
  });

  it("the fallback clock honours rate, reverse and loop", () => {
    const { project, controller, step } = setup();
    controller.setRate(2);
    controller.play();
    step(0);
    step(500);
    expect(project.getState().playheadUs).toBe(1_000_000);
    controller.setRate(-1);
    step(1000);
    expect(project.getState().playheadUs).toBe(500_000);
    step(2000); // past 0, no loop: stops at 0
    expect(project.getState().playheadUs).toBe(0);
    expect(controller.getState().playing).toBe(false);
    controller.play(); // backwards from the start: begins at the end
    expect(project.getState().playheadUs).toBe(4_000_000);
    controller.setLoop(true);
    step(3000);
    step(8000); // would pass 0: wraps to the end and keeps playing
    expect(project.getState().playheadUs).toBe(4_000_000);
    expect(controller.getState().playing).toBe(true);
    controller.setRate(1);
    step(8100); // forwards past the end with loop on: back to 0
    expect(project.getState().playheadUs).toBe(0);
    expect(controller.getState().playing).toBe(true);
  });
});
