/** A music clip's beat grid, in seconds from the start of the music. */
export interface BeatGrid {
  beats: readonly number[];
  downbeats?: readonly number[];
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Write a beat grid onto a sequence's stage root as `data-beats` / `data-downbeats`, so `S.beat(n)` and
 * `S.downbeat(n)` land on the music. `offsetSeconds` is how far into the music the sequence starts
 * (sequence start − music start + the music's trim): beats before it are dropped and the rest shift earlier.
 * Returns the template unchanged, with `found: false`, when it has no stage root.
 */
export function applyBeatGrid(template: string, grid: BeatGrid, offsetSeconds = 0): { template: string; found: boolean; beats: number; downbeats: number } {
  const shift = (list: readonly number[] | undefined) => (list ?? []).map((t) => round3(t - offsetSeconds)).filter((t) => t >= 0).sort((a, b) => a - b);
  const beats = shift(grid.beats);
  const downbeats = shift(grid.downbeats);
  const root = /<[a-zA-Z][^>]*\bdata-libs\s*=\s*["'][^"']*\bstage\b[^"']*["'][^>]*>/.exec(template);
  if (!root) return { template, found: false, beats: 0, downbeats: 0 };
  let tag = root[0];
  const set = (name: string, list: number[]) => {
    const attr = new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`);
    tag = attr.test(tag)
      ? list.length
        ? tag.replace(attr, ` ${name}='${JSON.stringify(list)}'`)
        : tag.replace(attr, "")
      : list.length
        ? tag.replace(/\s*\/?>$/, (end) => ` ${name}='${JSON.stringify(list)}'${end.trim() === "/>" ? "/>" : ">"}`)
        : tag;
  };
  set("data-beats", beats);
  set("data-downbeats", downbeats);
  return { template: template.slice(0, root.index) + tag + template.slice(root.index + root[0].length), found: true, beats: beats.length, downbeats: downbeats.length };
}
