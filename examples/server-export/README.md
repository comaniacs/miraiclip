# Server export example

A ready-to-run project document (`project.json`) — the repo's 4-second e2e
fixture video with a text overlay — plus the two ways to export it from Node.

Build first (once), from the repo root:

```sh
pnpm install
pnpm --filter @miraiclip/server-export build
```

## CLI

```sh
node packages/server-export/dist/cli.js examples/server-export/project.json \
  --out examples/server-export/out.mp4 --quality high
```

(After the package is published it's just `npx miraiclip-export project.json --out out.mp4`.)

`--format` is inferred from the `--out` extension; relative asset `src`s in
the project file resolve against the project file's directory. Uses your
installed Google Chrome — pass `--browser <path>` or set `MIRAICLIP_BROWSER`
to use another Chrome/Chromium. MP4 needs real Chrome (H.264); use a `.webm`
out path on free Chromium.

## Node API

```sh
node examples/server-export/export.mjs
```

`export.mjs` shows the programmatic call: `exportProjectFile(doc, options)`
with progress reporting, `assetsDir` resolution, and `out` writing. See the
[Server export docs](https://comaniacs.github.io/miraiclip/docs/export/server-side/)
for every option.
