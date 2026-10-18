/** Tiny PNG reader for tests: the RGB of the image's centre pixel. */
import { inflateSync } from "node:zlib";

export const PNG = {
  center(bytes: Uint8Array): [number, number, number] {
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
    const y = Math.floor(height / 2);
    const x = Math.floor(width / 2);
    let prev = new Uint8Array(stride);
    let row = new Uint8Array(stride);
    for (let r = 0; r <= y; r++) {
      const base = r * (stride + 1);
      const filter = raw[base]!;
      row = new Uint8Array(stride);
      for (let i = 0; i < stride; i++) {
        const v = raw[base + 1 + i]!;
        const a = i >= channels ? row[i - channels]! : 0;
        const b = prev[i]!;
        const c = i >= channels ? prev[i - channels]! : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        row[i] = (v + [0, a, b, (a + b) >> 1, paeth][filter]!) & 0xff;
      }
      prev = row;
    }
    return [row[x * channels]!, row[x * channels + 1]!, row[x * channels + 2]!];
  },
};
