/**
 * One file per recording: the screen video, the camera video (when there is
 * one) and the session log, packed into a plain ZIP. Entries are stored, not
 * compressed (the videos are compressed already), so packing is fast and
 * unpacking only slices the file: no video is copied in memory. Rename a
 * `.mcrec` to `.zip` to look inside.
 */
import { parseCaptureSession } from "./session.js";
import type { CaptureSession } from "./types.js";

/** File extension for a packed recording. */
export const RECORDING_FILE_EXTENSION = ".mcrec";
/** MIME type of a packed recording. */
export const RECORDING_FILE_TYPE = "application/vnd.miraiclip.recording+zip";

/** A recording's files: what `recording.stop()` returns, and what a packed recording holds. */
export interface RecordingFiles {
  screen: Blob;
  camera?: Blob;
  session: CaptureSession;
}

const SESSION_NAME = "session.json";
const MAX_ZIP32 = 0xffffffff;

/** Whether a picked file looks like a packed recording (by name: `.mcrec`, or `.zip`). */
export function isRecordingFile(file: { name: string }): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(RECORDING_FILE_EXTENSION) || name.endsWith(".zip");
}

/** Pack a recording's screen, camera and session into one `.mcrec` file. */
export async function packRecording({ screen, camera, session }: RecordingFiles): Promise<Blob> {
  const entries: { name: string; data: Blob }[] = [
    { name: SESSION_NAME, data: new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }) },
    { name: `screen.${videoExt(screen)}`, data: screen },
    ...(camera ? [{ name: `camera.${videoExt(camera)}`, data: camera }] : []),
  ];
  const { time, date } = dosDateTime(new Date(Date.parse(session.startedAt) || Date.now()));
  const utf8 = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = utf8.encode(entry.name);
    const size = entry.data.size;
    if (size > MAX_ZIP32 || offset > MAX_ZIP32) throw new Error("recording is too large to pack (over 4 GB)");
    const crc = await crc32(entry.data);

    const local = new DataView(new ArrayBuffer(30 + name.length));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    new Uint8Array(local.buffer).set(name, 30);

    const dir = new DataView(new ArrayBuffer(46 + name.length));
    dir.setUint32(0, 0x02014b50, true); // central directory header
    dir.setUint16(4, 20, true); // version made by
    dir.setUint16(6, 20, true); // version needed
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, size, true);
    dir.setUint32(24, size, true);
    dir.setUint16(28, name.length, true);
    // extra, comment, disk, attributes: 0
    dir.setUint32(42, offset, true);
    new Uint8Array(dir.buffer).set(name, 46);

    parts.push(local.buffer, entry.data);
    central.push(new Uint8Array(dir.buffer));
    offset += local.byteLength + size;
  }

  const dirSize = central.reduce((n, c) => n + c.length, 0);
  if (offset > MAX_ZIP32) throw new Error("recording is too large to pack (over 4 GB)");
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end.buffer], { type: RECORDING_FILE_TYPE });
}

/** Unpack a `.mcrec` (or a ZIP with the same files) back into its screen, camera and session. */
export async function unpackRecording(file: Blob): Promise<RecordingFiles> {
  const notOne = (why: string) => new Error(`not a Miraiclip recording file (${why})`);

  // The directory's end record is in the last 22 bytes (+ an optional comment).
  const tailLength = Math.min(file.size, 22 + 0xffff);
  const tail = new DataView(await file.slice(file.size - tailLength).arrayBuffer());
  let at = -1;
  for (let i = tailLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      at = i;
      break;
    }
  }
  if (at < 0) throw notOne("no ZIP directory");
  const count = tail.getUint16(at + 10, true);
  const dirSize = tail.getUint32(at + 12, true);
  const dirOffset = tail.getUint32(at + 16, true);
  const dir = new DataView(await file.slice(dirOffset, dirOffset + dirSize).arrayBuffer());
  const utf8 = new TextDecoder();

  const found = new Map<string, { offset: number; size: number; name: string }>();
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== 0x02014b50) throw notOne("damaged ZIP directory");
    const method = dir.getUint16(p + 10, true);
    const size = dir.getUint32(p + 20, true);
    const nameLength = dir.getUint16(p + 28, true);
    const extraLength = dir.getUint16(p + 30, true);
    const commentLength = dir.getUint16(p + 32, true);
    const offset = dir.getUint32(p + 42, true);
    const name = utf8.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    const base = name.split("/").pop()!.toLowerCase();
    const key = base === SESSION_NAME || base.endsWith(".session.json") ? "session" : base.startsWith("camera.") || base.includes(".camera.") ? "camera" : /\.(webm|mp4|mov|mkv)$/.test(base) ? "screen" : undefined;
    if (!key || found.has(key)) continue;
    if (method !== 0) throw new Error(`"${name}" is compressed in this ZIP; Miraiclip recordings store their files uncompressed`);
    found.set(key, { offset, size, name: base });
  }

  const read = async (key: string, type?: string): Promise<Blob | undefined> => {
    const entry = found.get(key);
    if (!entry) return undefined;
    // The data starts after the entry's own header, whose name and extra lengths can differ from the directory's.
    const local = new DataView(await file.slice(entry.offset, entry.offset + 30).arrayBuffer());
    if (local.byteLength < 30 || local.getUint32(0, true) !== 0x04034b50) throw notOne(`damaged entry "${entry.name}"`);
    const start = entry.offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    return file.slice(start, start + entry.size, type ?? (entry.name.endsWith(".mp4") ? "video/mp4" : entry.name.endsWith(".json") ? "application/json" : "video/webm"));
  };

  const sessionBlob = await read("session");
  if (!sessionBlob) throw notOne(`no ${SESSION_NAME}`);
  const session = parseCaptureSession(await sessionBlob.text());
  const screen = await read("screen", session.media.screen?.mimeType);
  if (!screen) throw notOne("no screen video");
  const camera = await read("camera", session.media.camera?.mimeType);
  return { screen, ...(camera ? { camera } : {}), session };
}

const videoExt = (blob: Blob) => (/mp4/i.test(blob.type) ? "mp4" : "webm");

function dosDateTime(d: Date) {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

let table: Uint32Array | undefined;
/** CRC-32 of a blob, read as a stream so big videos aren't held twice. */
async function crc32(blob: Blob): Promise<number> {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  const t = table;
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (let i = 0; i < value.length; i++) crc = t[(crc ^ value[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
