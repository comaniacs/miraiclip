import { inflateSync } from "node:zlib";

export type Rgba = [number, number, number, number];

/** Decodes an 8-bit RGB/RGBA PNG (any filter) into rows of RGBA, for pixel assertions on stills. */
export function decodePng(png: Uint8Array): { width: number; height: number; at: (x: number, y: number) => Rgba } {
  const buf = Buffer.from(png);
  let off = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows: Buffer[] = [];
  for (let r = 0; r < height; r++) {
    const start = r * (stride + 1);
    const filter = raw[start]!;
    const line = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    const prev = rows[r - 1];
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev ? prev[i]! : 0;
      const c = prev && i >= channels ? prev[i - channels]! : 0;
      const add = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      line[i] = (line[i]! + add) & 255;
    }
    rows.push(line);
  }
  return {
    width,
    height,
    at: (x, y) => {
      const row = rows[y]!;
      const o = x * channels;
      return [row[o]!, row[o + 1]!, row[o + 2]!, channels === 4 ? row[o + 3]! : 255];
    },
  };
}

/** RGBA at (x, y) of a PNG. */
export const pixelAt = (png: Uint8Array, x: number, y: number): Rgba => decodePng(png).at(x, y);

/** How many pixels satisfy `test`. */
export function countPixels(png: Uint8Array, test: (p: Rgba) => boolean): number {
  const img = decodePng(png);
  let n = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (test(img.at(x, y))) n++;
  return n;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
