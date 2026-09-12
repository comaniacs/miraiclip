import type { Asset, Clip, ImageClip, TextClip } from "@miraiclip/core";
import type {
  Placement,
  RevealDirection,
  SceneBackend,
  SceneNode,
  SolidSceneNode,
} from "../src/compositor/types.js";

export class FakeNode implements SceneNode {
  placement: Placement | undefined;
  visible = true;
  z = 0;
  destroyed = false;
  updates: Clip[] = [];
  reveal: { fraction: number; direction: RevealDirection } | undefined;

  constructor(
    readonly kind: string,
    readonly asset?: Asset,
  ) {}

  effects: unknown[] | undefined;
  setEffects(effects: readonly unknown[]): void {
    this.effects = [...effects];
  }

  setReveal(fraction: number, direction: RevealDirection): void {
    this.reveal = { fraction, direction };
  }

  setPlacement(placement: Placement): void {
    this.placement = { ...placement }; // contract: the caller may reuse the object
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
  setZ(z: number): void {
    this.z = z;
  }
  update(clip: Clip): void {
    this.updates.push(clip);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

export class FakeVideoNode extends FakeNode {
  frames: (unknown | null)[] = [];
  sourceSize: { widthPx: number; heightPx: number } | undefined;
  constructor() {
    super("video");
  }
  setFrame(frame: unknown | null): void {
    this.frames.push(frame);
  }
  setSourceSize(widthPx: number, heightPx: number): void {
    this.sourceSize = { widthPx, heightPx };
  }
  get lastFrame(): unknown | null {
    return this.frames.at(-1) ?? null;
  }
}

export class FakeSolidNode implements SolidSceneNode {
  colorRgb = -1;
  alpha = 0;
  visible = false;
  z = 0;
  destroyed = false;

  set(colorRgb: number, alpha: number): void {
    this.colorRgb = colorRgb;
    this.alpha = alpha;
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
  setZ(z: number): void {
    this.z = z;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

export class FakeBackend implements SceneBackend {
  nodes: FakeNode[] = [];
  solids: FakeSolidNode[] = [];
  size = { width: 0, height: 0 };
  renders = 0;
  destroyed = false;

  resize(widthPx: number, heightPx: number): void {
    this.size = { width: widthPx, height: heightPx };
  }
  createImage(_clip: ImageClip, asset: Asset | undefined): SceneNode {
    const node = new FakeNode("image", asset);
    this.nodes.push(node);
    return node;
  }
  createText(_clip: TextClip): SceneNode {
    const node = new FakeNode("text");
    this.nodes.push(node);
    return node;
  }
  createVideo(): FakeVideoNode {
    const node = new FakeVideoNode();
    this.nodes.push(node);
    return node;
  }
  createCaption(): FakeNode {
    const node = new FakeNode("caption");
    this.nodes.push(node);
    return node;
  }
  createSolid(): FakeSolidNode {
    const solid = new FakeSolidNode();
    this.solids.push(solid);
    return solid;
  }
  render(): void {
    this.renders++;
  }
  destroy(): void {
    this.destroyed = true;
  }
}
