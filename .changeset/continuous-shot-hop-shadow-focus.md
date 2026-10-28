---
"@miraiclip/renderer": minor
"@miraiclip/assistant": minor
---

Three stage-kit additions for continuous shots. `tl.hop` can now be chained: hopping the same element again starts from where it landed (a hop that would begin before the previous one ends throws, naming the time). `tl.shadow(target, opts)` and `hop({ shadow })` add a contact shadow that follows hops along the ground, thins and widens as the element lifts, and fades with the element's opacity. `tl.focus(target | depth | null, opts)` adds depth of field: elements marked `data-dof` blur by their distance from the focus depth, and a second call racks the focus. `lintSequence` knows both new verbs, and the sequence-core skill documents them.
