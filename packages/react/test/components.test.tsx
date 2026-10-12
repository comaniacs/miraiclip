import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import {
  PlaybackProvider,
  Preview,
  ProjectProvider,
  Scrubber,
  Timeline,
  TransformBox,
  useTimelineClip,
  useTracks,
} from "../src/index.js";

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no PointerEvent: a MouseEvent with pointer fields is enough here.
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
  }
});

const S = 1_000_000;

/** v1: a [0,2s) b [2s,3s) far [10s,11s) — v2 (locked): c [0,1s). */
function makeProject(): Project {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "a", trackId: "v1", startUs: 0, durationUs: 2 * S, text: "a" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "b", trackId: "v1", startUs: 2 * S, durationUs: 1 * S, text: "b" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "far", trackId: "v1", startUs: 10 * S, durationUs: 1 * S, text: "far" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "c", trackId: "v2", startUs: 0, durationUs: 1 * S, text: "c" } });
  });
  project.dispatch({ type: "track/set-property", payload: { trackId: "v2", locked: true } });
  project.clearHistory();
  return project;
}

const fallback = { isSupported: () => false, raf: () => 0, cancelRaf: () => undefined };

function Providers({ project, children }: { project: Project; children: ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <PlaybackProvider options={fallback}>{children}</PlaybackProvider>
    </ProjectProvider>
  );
}

function ClipLabel() {
  const { clip, startUs } = useTimelineClip();
  return (
    <span>
      {clip.id}@{startUs}
    </span>
  );
}

function TestTimeline() {
  const tracks = useTracks();
  return (
    <Timeline.Root pxPerSecond={100} headerWidth={50}>
      <Timeline.Viewport>
        <Timeline.Ruler data-testid="ruler" />
        {tracks.map((track) => (
          <Timeline.Track key={track.id} track={track} data-testid={`track-${track.id}`}>
            <Timeline.TrackHeader>{track.id}</Timeline.TrackHeader>
            <Timeline.Lane
              data-testid={`lane-${track.id}`}
              overlay={<Timeline.Cuts>{(cut) => <i data-testid="cut" data-x={cut.x} />}</Timeline.Cuts>}
            >
              {(clip) => (
                <Timeline.Clip clip={clip} data-testid={`clip-${clip.id}`}>
                  <ClipLabel />
                  <Timeline.TrimHandle side="end" data-testid={`trim-${clip.id}`} />
                </Timeline.Clip>
              )}
            </Timeline.Lane>
          </Timeline.Track>
        ))}
      </Timeline.Viewport>
    </Timeline.Root>
  );
}

const pointer = (type: string, init: PointerEventInit) => new window.PointerEvent(type, { bubbles: true, cancelable: true, ...init });

describe("<Timeline.*>", () => {
  it("lays clips out in time and renders only the visible range", () => {
    const project = makeProject();
    const { getByTestId, queryByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    const b = getByTestId("clip-b");
    expect(b.style.left).toBe("200px");
    expect(b.style.width).toBe("100px");
    expect(b.dataset.kind).toBe("text");
    expect(queryByTestId("clip-far")).toBeNull(); // 10 s is past the rendered range
    expect(getByTestId("track-v2").dataset.locked).toBe("");
    expect(getByTestId("lane-v1").dataset.trackId).toBe("v1");
    // The content is as wide as the header plus the scrollable length (11 s + 5 s).
    const content = getByTestId("ruler").parentElement!;
    expect(content.style.width).toBe(`${50 + 1600}px`);
  });

  it("selects on click and deselects on the empty lane", () => {
    const project = makeProject();
    const { getByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    fireEvent.click(getByTestId("clip-a"));
    expect(project.getState().selection).toEqual(["a"]);
    expect(getByTestId("clip-a").dataset.selected).toBe("");
    fireEvent.click(getByTestId("lane-v1"));
    expect(project.getState().selection).toEqual([]);
  });

  it("drags a clip with a live preview and commits one move on release", () => {
    const project = makeProject();
    const { getByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    act(() => {
      getByTestId("clip-a").dispatchEvent(pointer("pointerdown", { clientX: 10, clientY: 0, button: 0 }));
    });
    act(() => {
      document.dispatchEvent(pointer("pointermove", { clientX: 160, clientY: 0 }));
    });
    expect(getByTestId("clip-a").dataset.dragging).toBe("move");
    expect(getByTestId("clip-a").textContent).toBe(`a@${1.5 * S}`);
    expect(project.getState().doc.clips["a"]!.startUs).toBe(0); // nothing dispatched yet
    act(() => {
      document.dispatchEvent(pointer("pointerup", { clientX: 160, clientY: 0 }));
    });
    expect(project.getState().doc.clips["a"]!.startUs).toBe(1.5 * S);
    expect(getByTestId("clip-a").dataset.dragging).toBeUndefined();
    project.undo();
    expect(project.getState().doc.clips["a"]!.startUs).toBe(0);
  });

  it("trims from a handle and leaves locked clips in place", () => {
    const project = makeProject();
    const { getByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    act(() => {
      getByTestId("trim-b").dispatchEvent(pointer("pointerdown", { clientX: 300, clientY: 0, button: 0 }));
    });
    act(() => {
      document.dispatchEvent(pointer("pointermove", { clientX: 350, clientY: 0 }));
      document.dispatchEvent(pointer("pointerup", { clientX: 350, clientY: 0 }));
    });
    expect(project.getState().doc.clips["b"]!.durationUs).toBe(1.5 * S);

    act(() => {
      getByTestId("clip-c").dispatchEvent(pointer("pointerdown", { clientX: 10, clientY: 0, button: 0 }));
    });
    act(() => {
      document.dispatchEvent(pointer("pointermove", { clientX: 200, clientY: 0 }));
      document.dispatchEvent(pointer("pointerup", { clientX: 200, clientY: 0 }));
    });
    expect(project.getState().selection).toEqual(["c"]);
    expect(project.getState().doc.clips["c"]!.startUs).toBe(0);
  });

  it("marks cuts between back-to-back clips", () => {
    const project = makeProject();
    const { getAllByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    const cuts = getAllByTestId("cut");
    expect(cuts).toHaveLength(1);
    expect(cuts[0]!.dataset.x).toBe("200");
  });

  it("seeks from the ruler", () => {
    const project = makeProject();
    const { getByTestId } = render(
      <Providers project={project}>
        <TestTimeline />
      </Providers>,
    );
    act(() => {
      getByTestId("ruler").dispatchEvent(pointer("pointerdown", { clientX: 250, button: 0 }));
    });
    expect(project.getState().playheadUs).toBe(2.5 * S);
    expect(getByTestId("ruler").querySelectorAll("[data-tick]").length).toBeGreaterThan(0);
  });
});

describe("<Scrubber.*>", () => {
  it("is a slider that seeks with keys", () => {
    const project = makeProject();
    const { getByRole } = render(
      <Providers project={project}>
        <Scrubber.Root>
          <Scrubber.Range />
          <Scrubber.Thumb />
        </Scrubber.Root>
      </Providers>,
    );
    const slider = getByRole("slider");
    expect(slider.getAttribute("aria-valuemax")).toBe("11000");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(project.getState().playheadUs).toBe(1 * S);
    fireEvent.keyDown(slider, { key: "ArrowRight", shiftKey: true });
    expect(project.getState().playheadUs).toBe(6 * S);
    fireEvent.keyDown(slider, { key: "End" });
    expect(project.getState().playheadUs).toBe(11 * S);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(project.getState().playheadUs).toBe(0);
  });
});

describe("<Preview>", () => {
  it("sizes the canvas, exposes its state, and hides the transform box when not live", () => {
    const project = makeProject();
    let seen: { scale: number; mode: string } | undefined;
    const { container } = render(
      <Providers project={project}>
        <Preview width={500} height={250} data-testid="preview">
          {(state) => {
            seen = state;
            return (
              <TransformBox.Root data-testid="box">
                <TransformBox.Outline />
              </TransformBox.Root>
            );
          }}
        </Preview>
      </Providers>,
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.width).toBe("500px");
    expect(seen).toMatchObject({ scale: 0.5, mode: "unsupported" });
    expect(container.querySelector("[data-preview]")!.getAttribute("data-mode")).toBe("unsupported");
    expect(container.querySelector("[data-transform-box]")).toBeNull();
  });

  it("fits the composition into its parent when no size is given", () => {
    const project = makeProject();
    const parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 800 });
    Object.defineProperty(parent, "clientHeight", { value: 300 });
    document.body.appendChild(parent);
    const { container } = render(
      <Providers project={project}>
        <Preview />
      </Providers>,
      { container: parent },
    );
    const frame = container.querySelector<HTMLElement>("[data-preview]")!;
    expect(frame.style.width).toBe("600px"); // height-bound: 300 × 2:1
    expect(frame.style.height).toBe("300px");
    parent.remove();
  });
});
