// The one timeline for the DEWLIT UGC ad. SHOTS are the presenter slots (bottom track); LINES are the spoken script,
// timed for a natural delivery; captions, inserts and the score all read these numbers. Seconds.
export const T = { DUR: 30, FPS: 30, W: 1080, H: 1920 };

export const SHOTS = [
  { id: "p1", t: [0.0, 4.0], frame: "Selfie MCU · vanity · window light left", action: "Mid-thought, half-laugh, eyebrows up" },
  { id: "p2", t: [4.0, 8.0], frame: "Selfie MCU · lifts bottle beside cheek", action: "Turns label to lens, curious" },
  { id: "p3", t: [8.0, 15.0], frame: "Close-up hands over sink", action: "Unscrews dropper · 2 drops on fingertips" },
  { id: "p4", t: [15.0, 21.0], frame: "Mirror / over-the-shoulder", action: "Presses serum into cheeks · small shrug" },
  { id: "p5", t: [21.0, 26.0], frame: "Selfie MCU · bottle near jaw", action: "Sincere half-smile · sets bottle down" },
  { id: "p6", t: [26.0, 30.0], frame: "Selfie MCU · final look to lens", action: "Natural smile · reaches to stop recording" },
];

// [start, end, text]; the caption shows the words as they are spoken (one word every (end-start)/n seconds)
export const LINES = [
  [0.35, 3.6, "Okay, I wasn't gonna post about this yet, but…"],
  [4.15, 7.7, "this is the Cloud Milk Serum from Dewlit. I've had it about a week."],
  [8.9, 11.4, "Look at the texture."],
  [11.6, 14.6, "It's literally milky… and really light."],
  [15.4, 19.6, "Two drops, pat it in, done. That's honestly it."],
  [21.3, 25.2, "It's just easy. I keep reaching for it."],
  [26.3, 29.2, "Link's in my bio if you wanna try it."],
];

// built inserts that cut in over the presenter, and the emphasis captions
export const INSERTS = { bottle: [5.0, 6.6], texture: [8.4, 11.8], vanity: [23.0, 24.9], end: [26.6, 30] };
export const EMPHASIS = [[0.5, 3.7, "the step I didn't plan to post"], [5.1, 7.8, "Meet Cloud Milk Serum"], [8.6, 11.6, "look at this texture"], [15.5, 20.6, "2 drops · pat · done"]];
