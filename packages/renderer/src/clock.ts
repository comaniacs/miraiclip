import type { Us } from "./media/types.js";

/**
 * The compositor renders as a pure function of (document, clock.timeUs).
 * Playback uses a realtime clock (audio-driven once the audio graph lands);
 * export drives the same compositor with a StepClock.
 */
export interface Clock {
  readonly timeUs: Us;
  readonly playing: boolean;
}

/** Deterministic clock for export and tests: time moves only when told to. */
export class StepClock implements Clock {
  private currentUs: Us = 0;

  get timeUs(): Us {
    return this.currentUs;
  }

  get playing(): boolean {
    return false;
  }

  setTime(us: Us): void {
    this.currentUs = us;
  }

  /** Advance exactly one frame at the given rate. */
  step(fps: number): Us {
    this.currentUs += Math.round(1_000_000 / fps);
    return this.currentUs;
  }
}

/**
 * Wall-clock playback clock with rate control. The time source is injectable
 * (defaults to performance.now / Date.now) so it is fully testable; the audio
 * graph will later supply an AudioContext-derived source for drift-free sync.
 */
export class RealtimeClock implements Clock {
  private baseUs: Us = 0;
  private startedAtMs: number | null = null;
  private currentRate = 1;

  constructor(
    private readonly nowMs: () => number = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now(),
  ) {}

  get playing(): boolean {
    return this.startedAtMs !== null;
  }

  get rate(): number {
    return this.currentRate;
  }

  get timeUs(): Us {
    if (this.startedAtMs === null) return this.baseUs;
    const elapsedUs = (this.nowMs() - this.startedAtMs) * 1000 * this.currentRate;
    return Math.max(0, Math.round(this.baseUs + elapsedUs));
  }

  play(): void {
    if (this.startedAtMs !== null) return;
    this.startedAtMs = this.nowMs();
  }

  pause(): void {
    if (this.startedAtMs === null) return;
    this.baseUs = this.timeUs;
    this.startedAtMs = null;
  }

  seek(us: Us): void {
    this.baseUs = Math.max(0, us);
    if (this.startedAtMs !== null) this.startedAtMs = this.nowMs();
  }

  setRate(rate: number): void {
    if (rate <= 0) throw new Error("rate must be > 0");
    this.baseUs = this.timeUs;
    if (this.startedAtMs !== null) this.startedAtMs = this.nowMs();
    this.currentRate = rate;
  }
}
