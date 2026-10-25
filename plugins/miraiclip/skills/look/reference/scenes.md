# Still scenes (design_scene)

How to write `design_scene` scenes that look made for the brief and finished. Every scene is HTML and CSS in a full-frame box that is a CSS container. Units, safe area, tokens, type scale and picture treatments are in this skill's EDITOR.md (the frame applies to every film). This file is what is particular to still scenes: their CSS animation classes, rhythm across scenes, and patterns.

For motion graphics (one continuous move across a whole act), use `compose_sequence` instead, with the `sequence-core` and `motion` skills.

## Motion

- Entrances: `class="k-rise" style="--d:.4s"`. Stagger related items 0.12–0.25 s apart, in reading order. Everything has arrived by `T − 1 s`, so the scene holds before it fades.
- `--d` is inherited: set it on each element you stagger (and `--d:0s` on a container whose own animation must start at once).
- One continuous move per scene (the camera push, `k-pan`, or `k-kb` on a picture), so nothing is ever frozen.
- Your own `@keyframes` are welcome. Time them with `--T` when they last the whole scene: `animation: drift var(--T) linear both`.
- Lines and shapes that draw: SVG with `stroke-dasharray` / `stroke-dashoffset` keyframes, or `.k-draw` on a thin div.
- Typing: `.k-type` on an inline-block line, with `animation-timing-function: steps(n)` where n ≈ its characters.

## Rhythm

- **Plan the sequence of compositions** before designing: e.g. full-bleed photo → split → big type → grid → close-up crop → diagram → full-bleed. Never the same composition twice in a row, and not one pattern on a loop.
- **Change scale**: follow a wide shot with a detail. Crop into a picture (`object-position` and a larger scale) for a close-up, and a big number after small text.
- **Keep it alive**: a scene's last entrance lands no more than about 2 s before it ends. Long scenes get a second beat (a label, a line that draws, a detail that appears) or a continuous move (`k-kb` on the picture, `k-pan` on a layer).
- **Captions over photos**: a gradient for legibility, the caption on a third, and a small label or source line. With letterbox bars, keep it above the bottom bar.

## Patterns

These are starting points. Mix them and make them belong to the concept.

- **Statement**: one line set huge, the key word in the accent, a small label above. Use for a hook, a turn or a promise.
- **Split**: a picture on one side (`k-cover` in a rounded frame with `k-kb`), headline and two lines on the other. In portrait, the picture goes above.
- **Full-bleed picture**: the picture fills the frame (`k-fill` + `k-cover` + `k-kb`). A gradient from `var(--bg)` keeps the caption legible: `linear-gradient(transparent 45%, color-mix(in srgb, var(--bg) 85%, transparent))`.
- **Grid**: 3–4 cards with a picture or icon, a title and one line. Deal them in with a stagger and give each a slight rotation.
- **Diagram**: boxes joined by SVG lines that draw, for a flow, a loop or an architecture. Label each box. The film's own idea drawn out beats a stock card layout.
- **Console / log**: monospaced lines typing in one after another, with prompts, statuses and a highlighted result. Use for technical subjects.
- **List as a path**: items along a line or a rail that draws, each ticking off as it's reached.
- **Number**: one real figure set huge, with its unit and one line of meaning.
- **Collage**: 3–5 pictures overlapping at angles, settling while the camera pulls back.
- **Close**: the name, one line, the call to action, the address.

## Before you send a scene

- Text inside the frame and its boxes; nothing overlapping; nothing under 2.5cqmin.
- The frame is balanced: no big empty half, no content crammed in a corner.
- It follows the concept: motif, layout and motion. It doesn't look like the scene before it.
- Real words only: no placeholders, no invented people or numbers.

## Example: a console syllabus (course on building AI agents)

```html
<div class="con k-fill">
  <div class="con-bar k-fade"><i></i><i></i><i></i><span>agent.run(course)</span></div>
  <div class="con-body">
    <p class="k-type" style="--d:.3s">&gt; plan --modules 4</p>
    <p class="con-ok k-rise" style="--d:1.1s"><b>01</b> Agent fundamentals <em>2 weeks</em></p>
    <p class="con-ok k-rise" style="--d:1.35s"><b>02</b> Tools and APIs <em>3 weeks</em></p>
    <p class="con-ok k-rise" style="--d:1.6s"><b>03</b> Planning and memory <em>3 weeks</em></p>
    <p class="con-ok k-rise" style="--d:1.85s"><b>04</b> Multi-agent systems <em>4 weeks</em></p>
    <p class="con-done k-pop" style="--d:2.4s">✓ 12 weeks · 4 projects</p>
  </div>
</div>
```

```css
.con{inset:14cqh 12cqw;display:flex;flex-direction:column;border-radius:2.4cqmin;background:var(--card);border:.15cqmin solid var(--line);overflow:hidden;font-family:'JetBrains Mono Variable',ui-monospace,monospace}
.con-bar{display:flex;align-items:center;gap:1cqmin;padding:2cqmin 3cqmin;border-bottom:.15cqmin solid var(--line);font-size:2.8cqmin;color:var(--mut)}
.con-bar i{width:1.4cqmin;height:1.4cqmin;border-radius:50%;background:var(--line)}
.con-bar span{margin-left:2cqmin}
.con-body{flex:1;padding:4cqmin 5cqmin;display:flex;flex-direction:column;justify-content:center;gap:2.4cqmin;font-size:4.6cqmin}
.con-ok b{color:var(--p);margin-right:2cqmin}
.con-ok em{font-style:normal;color:var(--mut);margin-left:2cqmin;font-size:3.2cqmin}
.con-done{align-self:flex-start;margin-top:1cqmin;padding:1.2cqmin 2.6cqmin;border-radius:1cqmin;background:var(--p);color:var(--onp);font-size:3.4cqmin}
```
