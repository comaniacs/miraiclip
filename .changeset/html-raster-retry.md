---
"@miraiclip/renderer": patch
---

Html clips no longer render blank at some output sizes: the texture was built with a fractional resolution, Pixi's float round-trip (1388 / 1.4167 × 1.4167 = 1387.99…) made it resize the raster canvas, and resizing a canvas clears it — e.g. a 2720px-wide preview or export. Html clips also recover from a failed raster (a font fetch during a dev-server restart, say): the node retries on a backoff instead of keeping a stale or empty frame.
