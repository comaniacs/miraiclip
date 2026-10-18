/**
 * Read an audio file's duration from its bytes, without decoding: WAV from
 * its header, MP3 by walking its frames. Generators use it so voice clips
 * carry an exact length (narration timing depends on it). Returns undefined
 * for formats it doesn't know.
 */

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

export function wavDurationUs(bytes: Uint8Array): number | undefined {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return undefined;
  const v = view(bytes);
  let byteRate = 0;
  for (let off = 12; off + 8 <= bytes.length; ) {
    const id = ascii(bytes, off, 4);
    let size = v.getUint32(off + 4, true);
    if (id === "fmt ") byteRate = v.getUint32(off + 16, true);
    if (id === "data") {
      // Streamed WAVs (OpenAI) write 0 or 0xFFFFFFFF as the size: use what's actually there.
      if (size === 0 || size === 0xffffffff || off + 8 + size > bytes.length) size = bytes.length - off - 8;
      return byteRate ? Math.round((size / byteRate) * 1_000_000) : undefined;
    }
    off += 8 + size + (size % 2);
  }
  return undefined;
}

const BITRATES: Record<string, number[]> = {
  // [version][layer] → kbps by index; V1 = MPEG-1, V2 = MPEG-2/2.5.
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
};
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function mp3DurationUs(bytes: Uint8Array): number | undefined {
  let off = 0;
  // Skip an ID3v2 tag.
  if (ascii(bytes, 0, 3) === "ID3" && bytes.length > 10) {
    off = 10 + ((bytes[6]! & 0x7f) << 21) + ((bytes[7]! & 0x7f) << 14) + ((bytes[8]! & 0x7f) << 7) + (bytes[9]! & 0x7f);
  }
  let samples = 0;
  let rate = 0;
  let frames = 0;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff || (bytes[off + 1]! & 0xe0) !== 0xe0) {
      off++;
      continue;
    }
    const versionBits = (bytes[off + 1]! >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layerBits = (bytes[off + 1]! >> 1) & 3; // 1 = III, 2 = II, 3 = I
    const bitrateIndex = bytes[off + 2]! >> 4;
    const rateIndex = (bytes[off + 2]! >> 2) & 3;
    const padding = (bytes[off + 2]! >> 1) & 1;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
      off++;
      continue;
    }
    const layer = 4 - layerBits;
    const v1 = versionBits === 3;
    const kbps = BITRATES[`${v1 ? 1 : 2}-${layer}`]![bitrateIndex]!;
    const sampleRate = RATES[versionBits]![rateIndex]!;
    const perFrame = layer === 1 ? 384 : layer === 3 && !v1 ? 576 : 1152;
    const length = layer === 1 ? Math.floor(((12 * kbps * 1000) / sampleRate + padding) * 4) : Math.floor((perFrame / 8) * ((kbps * 1000) / sampleRate)) + padding;
    if (length < 4) {
      off++;
      continue;
    }
    if (frames === 0) {
      // A Xing/Info header (LAME, most encoders) in the first frame knows the exact length:
      // its frame count, minus the encoder delay and padding from the LAME tag.
      const xingAt = [4, 13, 21, 36].map((k) => off + k).find((at) => ["Xing", "Info"].includes(ascii(bytes, at, 4)));
      if (xingAt !== undefined) {
        const xv = view(bytes);
        const flags = xv.getUint32(xingAt + 4);
        if (flags & 1) {
          const total = xv.getUint32(xingAt + 8);
          let trim = 0;
          if (ascii(bytes, xingAt + 120, 4) === "LAME" && xingAt + 144 <= bytes.length) {
            const d = (bytes[xingAt + 141]! << 16) | (bytes[xingAt + 142]! << 8) | bytes[xingAt + 143]!;
            trim = (d >> 12) + (d & 0xfff) + 529; // + the decoder's own delay
          }
          return Math.round(((total * perFrame - trim) / sampleRate) * 1_000_000);
        }
      }
    }
    samples += perFrame;
    rate = sampleRate;
    frames++;
    off += length;
  }
  return frames && rate ? Math.round((samples / rate) * 1_000_000) : undefined;
}

/** Duration of WAV or MP3 bytes, by MIME type (or sniffing when the type is vague). */
export function audioDurationUs(data: ArrayBuffer | Uint8Array, mimeType = ""): number | undefined {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const type = mimeType.toLowerCase();
  if (type.includes("wav") || ascii(bytes, 0, 4) === "RIFF") return wavDurationUs(bytes);
  if (type.includes("mpeg") || type.includes("mp3") || ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return mp3DurationUs(bytes);
  return undefined;
}
