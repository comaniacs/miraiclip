/** Minimal PNG decoder for tests (8-bit RGB/RGBA, non-interlaced). */
import { inflateSync } from "node:zlib";

export interface Image {
  width: number;
  height: number;
  /** RGBA, row-major. */
  pixels: Uint8Array;
}

export function decodePng(bytes: Uint8Array): Image {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const channels = bytes[25] === 6 ? 4 : 3;
  const idat: Uint8Array[] = [];
  for (let off = 8; off < bytes.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.subarray(off + 4, off + 8));
    if (type === "IDAT") idat.push(bytes.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let r = 0; r < height; r++) {
    const base = r * (stride + 1);
    const filter = raw[base]!;
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[base + 1 + i]!;
      const a = i >= channels ? row[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = (v + pred) & 255;
    }
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 3; k++) out[(r * width + x) * 4 + k] = row[x * channels + k]!;
      out[(r * width + x) * 4 + 3] = channels === 4 ? row[x * channels + 3]! : 255;
    }
    prev = row;
  }
  return { width, height, pixels: out };
}

/** Mean absolute RGB difference between two images inside a box (pixels). */
export function diff(a: Image, b: Image, box = { x: 0, y: 0, width: a.width, height: a.height }): number {
  let sum = 0;
  let n = 0;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      const i = (y * a.width + x) * 4;
      for (let k = 0; k < 3; k++) sum += Math.abs(a.pixels[i + k]! - b.pixels[i + k]!);
      n += 3;
    }
  }
  return sum / n;
}

export function pixel(img: Image, x: number, y: number): [number, number, number] {
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.pixels[i]!, img.pixels[i + 1]!, img.pixels[i + 2]!];
}
