/** three.js as a scripted library, drawn per frame by tl.frame. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

const SEQ = `<div class="stage" data-libs="stage three" data-duration="4" data-stage-version="2"><canvas id="c" width="64" height="64"></canvas></div><script>stage.build((tl, S) => {
  const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), preserveDrawingBuffer: true });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50); cam.position.set(0, 0, 5);
  const box = new THREE.Mesh(new THREE.RoundedBoxGeometry(1, 1, 1, 2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  scene.add(box);
  tl.frame((t) => { box.position.x = -3 + t * 1.5; r.render(scene, cam); });
});</script>`;

describe("three", () => {
  it("draws a frame from the time alone, so a seek back gives the same pixels", async (ctx) => {
    const s = await openShot(SEQ, "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toBeUndefined();
    const px = () => s.page.evaluate(() => {
      const c = document.getElementById("c") as HTMLCanvasElement;
      const g = document.createElement("canvas"); g.width = 64; g.height = 64;
      const x = g.getContext("2d")!; x.drawImage(c, 0, 0);
      return Array.from(x.getImageData(32, 32, 1, 1).data.slice(0, 3));
    });
    await s.seek(2); // box at x = 0: the centre is red
    const a = await px();
    expect(a[0]).toBeGreaterThan(200);
    await s.seek(0.2); // box far left: the centre is black
    expect((await px())[0]).toBeLessThan(20);
    await s.seek(2);
    expect(await px()).toEqual(a);
    await s.close();
  });
});
