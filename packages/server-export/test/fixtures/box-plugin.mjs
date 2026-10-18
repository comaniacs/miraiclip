// A standalone Miraiclip plugin (no imports): a solid "box" clip kind and a
// "tint" effect. Everything it needs arrives through `register(api)`.
export default {
  name: "test-box",
  version: "1.0.0",
  register({ z, core, renderer }) {
    core.registerClipKind("test/box", {
      propsSchema: z.object({ color: z.string().default("#ff0000"), widthFrac: z.number().default(1), heightFrac: z.number().default(1) }),
      trackKinds: ["video"],
    });
    core.registerEffectKind("test/tint", z.object({ amount: z.number().min(0).max(1).default(1) }));
    if (!renderer) return; // Node: validation only
    const { Graphics, ColorMatrixFilter } = renderer.pixi;
    renderer.registerClipRenderer("test/box", {
      create(container, clip, ctx) {
        const g = new Graphics();
        container.addChild(g);
        const draw = (c) => {
          const { width, height } = ctx.compositionSize();
          const w = width * c.props.widthFrac;
          const h = height * c.props.heightFrac;
          g.clear();
          g.rect(-w / 2, -h / 2, w, h).fill(c.props.color);
        };
        return { update: draw };
      },
    });
    renderer.registerEffectRenderer("test/tint", (params) => {
      const filter = new ColorMatrixFilter();
      const apply = (p) => {
        filter.reset();
        // swap red into green: a red box turns green at amount 1
        filter.matrix = [1 - p.amount, 0, 0, 0, 0, p.amount, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      };
      apply(params);
      return { kind: "test/tint", filter, update: apply };
    });
  },
};
