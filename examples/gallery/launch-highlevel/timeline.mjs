// The one timeline for the HighLevel AI Employee launch film ("One day"): the picture (film/*.js) and the score
// (audio.mjs) both read it. Seconds, at 96 BPM: a beat is 0.625 s and a bar 2.5 s.
export const BEAT = 0.625;
// The six AI Employee modules (names from HighLevel's November 2024 AI Employee launch), each owning one moment of a day.
// [id, start, clock hour, eyebrow, headline, sub-line]
export const SCENES = [
  ["voice", 8.75, 2.25, "VOICE AI", "Picks up. Day or night.", "Handles inbound and outbound calls with a natural voice."],
  ["conv", 15.625, 7.7, "CONVERSATION AI", "Replies on every channel.", "SMS, web chat, Facebook and Instagram, in context."],
  ["rev", 22.5, 9.25, "REVIEWS AI", "Answers every review.", "Drafts thoughtful replies that keep your reputation strong."],
  ["content", 29.375, 11.5, "CONTENT AI", "Writes posts, blogs, images.", "On-brand content from a single prompt."],
  ["funnel", 36.25, 14.08, "FUNNEL AI", "Builds funnels from a prompt.", "Pages, flow and copy, ready to edit."],
  ["flow", 43.125, 16.67, "WORKFLOW AI ASSISTANT", "Builds automations with you.", "Describe the follow-up; it suggests the steps."],
];
export const T = {
  DUR: 60,
  FPS: 30,
  hook: [0, 5], //            2:14 AM, a lead calls: who picks up?
  ring: [0.0, 1.25, 2.5, 3.75], // the phone rings on each bar
  hk1: [0.7, 4.3],
  hk2: [2.5, 4.3],
  answer: 4.35, //            the call is answered
  reveal: [5, 8.75], //       meet your AI Employee
  scenes: SCENES.map((s) => s[1]),
  recap: [50, 55], //         11:59 PM: one day, six teammates
  end: [55, 60],
  logo: 55.4,
  title: 55.9,
  url: 56.8,
  rest: [58.4, 60],
};
