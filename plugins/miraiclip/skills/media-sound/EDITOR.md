---
name: media-sound
description: Pictures, music and sound effects for a film from a brief — when to find vs generate images and their rights, choosing music by mood and tempo before building, timing acts to the music, placing sound effects on moves, and mix levels. Load it when a film needs pictures or sound.
---

# Media and sound

## Pictures

**Only the subject's own media.** A film may show:

- pictures or clips the user added in this chat or names;
- a brand's own `brand-*` assets (from `get_brand`);
- pictures you get with the image tools.

Anything else already in the project (samples, an earlier project's media) has nothing to do with this subject. The editor refuses it.

**Find or generate:**

| The moment shows… | Tool | Query |
|---|---|---|
| Something real: a person, place, product, show, event, building | `find_images` | One specific query per moment: "Lisbon tram Alfama street", "The Mentalist Patrick Jane Simon Baker" |
| A concept, mood or story moment with no real picture | `generate_image` | Describe the picture, not the film: "a student coding late at night, warm desk lamp". The film's palette is added for you, and pictures come without text |

**Never:**

- generate a real person's face, a real product's screens or a real logo;
- put text in a generated picture (set the words in HTML).

**Rights:** web images belong to their owners. Say so in your reply, and credit the source on screen when a film is *about* an organisation ("Images: NASA").

**Not set up?** If a tool says it isn't configured, tell the user they can add a Tavily or Gemini key in AI settings → Images. Then design with type, shape and motion: a film without pictures can be very good.

**Use pictures the way the look says** (the `look` skill: frames, duotone, texture). In motion graphics a picture is usually an element that moves: it flies in with blur, it is a tile in a grid that becomes a wall, it is the inside of a window the camera pushes into. It rarely holds as a full-frame slide.

## Music

**Choose the music before you build.** The music sets the pace, so its length and tempo shape the acts:

1. Pick the mood and tempo from the brief and the look:

   | Film | Mood | Tempo |
   |---|---|---|
   | Playful | Bouncy, plucky | About 110–125 bpm |
   | Launch | Bright, driving | About 115–128 bpm |
   | Calm explainer, course | Light, warm | About 90–110 bpm |
   | Trailer | Low drones and pulses that build to hits | Free |
   | Documentary | Piano, strings, ambient | Slow |

2. `search_audio` with the music words `plan_film` returned, plus the mood and genre ("upbeat electronic pluck", "warm acoustic", "cinematic tension build"). Prefer a track at least as long as the film. Use `generate_audio` (music, `instrumental: true`) only when the user asks, or when nothing fits.
3. Plan act lengths in whole musical phrases.
   - At 120 bpm a bar is 2 s, so a 4-bar phrase is 8 s and an 8-bar phrase is 16 s.
   - At 100 bpm, 4 bars are 9.6 s.

   If you don't know the tempo, keep acts at 8–12 s and beats at 0.5 s multiples. Big moves land on whole seconds.
4. Add it before composing the acts: `add_audio` at 0 s, covering the whole film. Fade in 1 s and out 2 s.
5. Call `get_beat_grid`. It measures the music's tempo and beats, and from then on every act composed with `compose_sequence` gets them as `S.beats`. It tells you the tempo, the bar length and the beat times; move the treatment's beats onto them.

**The beat grid.** After `get_beat_grid`, `S.beats` / `S.beat(n)` in a sequence give the beat times *within that act*, so a move can land on the beat: `tl.label("hit", S.beat(8)).from(".w3", {...}, "hit")`. Put each beat's label on a beat. compose_sequence reports how many labels land within 80 ms of a beat. Without a grid, `S.beat(n)` is n × 0.5 s, a steady 120 bpm.

## Sound effects

Sound effects sell motion. Place them on moves, sparingly:

| Move | Sound |
|---|---|
| A whip pan, zoom-through, fast fly-in | A short whoosh, starting about 0.1 s before the move peaks |
| A pop-in, chip, badge | A soft pop or click |
| Typing | Light key ticks (a short loop, not one per letter) |
| A count-up, ticking list | Ticks |
| A collide-and-merge, title reveal, logo lock-up | One impact or hit, with a riser into it |
| A blur-through | An air swell |

- Place them with `add_sound_effects`: name the act and its labels, and the kind of sound for each (whoosh, pop, tick, impact, riser, swell). It finds a fitting sound, puts it on its own track at the label's time in the film (a whoosh starts slightly before its move), and mixes it under the music.
- **At most one effect per beat**, and none on every element of a stagger. Three good whooshes beat twenty.
- Silence is a tool: drop the effects in a reflective act.

## Mix levels

| Layer | Volume |
|---|---|
| Music, no voice | 0.7 |
| Music under a voice | 0.25–0.4 |
| Voice | 1 |
| Sound effects | 0.4–0.7 (they should be felt more than heard) |

- Fade music out over the last 2 s, ending on the end card's hold.
- Nothing should clip: if effects pile up at a hit, lower the music there or drop an effect.

## In your reply

Say what the music is (title and source) and its licence. Say which pictures came from the web, and that they belong to their owners. Say which pictures were generated.
