# @miraiclip/editor

The logic of a video editor UI, with no UI framework. Everything except the media-import helpers runs without a DOM (Node, workers, tests). Framework adapters such as [`@miraiclip/react`](../react) build on it, and vanilla apps can use it directly.

- **Timeline geometry**: `usToPx` / `pxToUs`, `visibleRange` (virtualisation), `zoomAtPoint`, playhead follow and reveal
- **Clip drag and trim**: `beginClipDrag` with snapping to clip edges, 0 and the playhead; one undo step per drag; locked tracks respected
- **Selectors**: `clipsByTrack`, `clipsInRange`, `compositionDurationUs`, `isTrackFree`, cached per document
- **Commands**: `createCommands(project)`, typed builders for every built-in command
- **Gestures**: `beginGesture`, a live edit (canvas drag, slider) that lands in history as one entry
- **Shortcuts**: `matchEditorShortcut` + `runEditorAction` (delete, split, undo, redo)
- **Placement and framing**: `placeAssetOnTrack`, `placeAssetAtPlayhead`, `ASPECT_PRESETS`, `fillScale`
- **Media import (browser)**: `probeMediaFile` reads a dropped file's kind, duration, size and a thumbnail; `isSourceReachable` finds missing media

## Install

```bash
npm install @miraiclip/core @miraiclip/editor
```

## A clip drag in plain DOM

```ts
import { beginClipDrag, pxToUs } from "@miraiclip/editor";

el.addEventListener("pointerdown", (down) => {
  const drag = beginClipDrag(project, clipId, "move", { snapThresholdUs: pxToUs(8, pxPerSecond) });
  if (!drag) return; // locked track
  const move = (e: PointerEvent) => {
    const { startUs } = drag.update(pxToUs(e.clientX - down.clientX, pxPerSecond));
    el.style.left = `${(startUs / 1e6) * pxPerSecond}px`;
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", () => {
    removeEventListener("pointermove", move);
    drag.commit(); // one clip/move, one undo step
  }, { once: true });
});
```

**Documentation**: [docs.miraiclip.com](https://docs.miraiclip.com/) · [Source](https://github.com/comaniacs/miraiclip)
