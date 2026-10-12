import { StrictMode, useRef, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import {
  PlaybackProvider,
  ProjectProvider,
  ProjectSessionProvider,
  useClips,
  useEditorShortcuts,
  usePlayback,
  usePlayheadRef,
  useProject,
  useProjectSession,
  useSelectedClip,
  useTracks,
  useUndoRedo,
} from "../src/index.js";

afterEach(cleanup);

const S = 1_000_000;

function makeProject(): Project {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "a", trackId: "v1", startUs: 0, durationUs: 2 * S, text: "a" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "b", trackId: "v2", startUs: 0, durationUs: 4 * S, text: "b" } });
  });
  project.clearHistory();
  return project;
}

/** Manual frame clock + a fake "unsupported" browser: playback runs on the fallback clock. */
function playbackOptions() {
  const frames: ((ts: number) => void)[] = [];
  return {
    frames,
    step: (ts: number) => frames.splice(0).forEach((cb) => cb(ts)),
    options: {
      isSupported: () => false,
      raf: (cb: (ts: number) => void) => frames.push(cb),
      cancelRaf: () => undefined,
    },
  };
}

function wrapperFor(project: Project, extra?: (children: ReactNode) => ReactNode) {
  return ({ children }: { children: ReactNode }) => (
    <ProjectProvider project={project}>{extra ? extra(children) : children}</ProjectProvider>
  );
}

describe("ProjectProvider", () => {
  it("creates the project once from init + seed, and the seed is not undoable", () => {
    const seen: Project[] = [];
    function Probe() {
      const project = useProject();
      seen.push(project);
      return null;
    }
    const { rerender } = render(
      <ProjectProvider
        init={{ width: 640, height: 360, fps: 25 }}
        seed={(p) => p.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } })}
      >
        <Probe />
      </ProjectProvider>,
    );
    rerender(
      <ProjectProvider init={{ width: 640, height: 360, fps: 25 }}>
        <Probe />
      </ProjectProvider>,
    );
    expect(seen[0]).toBe(seen.at(-1));
    expect(seen[0]!.getState().doc.tracks["t"]).toBeDefined();
    expect(seen[0]!.canUndo()).toBe(false);
  });

  it("throws a clear error outside a provider", () => {
    expect(() => renderHook(() => useProject())).toThrow(/within <ProjectProvider>/);
  });
});

describe("state hooks", () => {
  it("re-render only when their slice changes, not on playhead moves", () => {
    const project = makeProject();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useClips("v1");
      },
      { wrapper: wrapperFor(project) },
    );
    expect(result.current.map((c) => c.id)).toEqual(["a"]);
    const before = renders;
    act(() => project.setPlayhead(1 * S));
    act(() => project.dispatch({ type: "clip/move", payload: { clipId: "b", startUs: 1 * S } })); // other track
    expect(renders).toBe(before);
    act(() => project.dispatch({ type: "clip/move", payload: { clipId: "a", startUs: 3 * S } }));
    expect(renders).toBe(before + 1);
    expect(result.current[0]!.startUs).toBe(3 * S);
  });

  it("tracks the selection, the tracks list and undo availability", () => {
    const project = makeProject();
    const { result } = renderHook(
      () => ({ selected: useSelectedClip(), tracks: useTracks(), history: useUndoRedo() }),
      { wrapper: wrapperFor(project) },
    );
    expect(result.current.tracks.map((t) => t.id)).toEqual(["v1", "v2"]);
    expect(result.current.history.canUndo).toBe(false);
    act(() => project.setSelection(["b"]));
    expect(result.current.selected?.id).toBe("b");
    act(() => project.dispatch({ type: "track/remove", payload: { id: "v1" } }));
    expect(result.current.tracks.map((t) => t.id)).toEqual(["v2"]);
    expect(result.current.history.canUndo).toBe(true);
    act(() => {
      result.current.history.undo();
    });
    expect(result.current.history).toMatchObject({ canUndo: false, canRedo: true });
  });

  it("usePlayheadRef follows the playhead without re-rendering", () => {
    const project = makeProject();
    const seen: number[] = [];
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return usePlayheadRef((us) => seen.push(us));
      },
      { wrapper: wrapperFor(project) },
    );
    const before = renders;
    act(() => project.setPlayhead(1.5 * S));
    expect(result.current.current).toBe(1.5 * S);
    expect(seen).toEqual([1.5 * S]);
    expect(renders).toBe(before);
  });
});

describe("ProjectSessionProvider", () => {
  it("swaps the project on loadDocument and resets on newProject", () => {
    const loaded = makeProject().toJSON();
    const { result } = renderHook(() => ({ session: useProjectSession(), project: useProject() }), {
      wrapper: ({ children }) => (
        <ProjectSessionProvider initial={{ init: { width: 640, height: 360, fps: 30 } }}>{children}</ProjectSessionProvider>
      ),
    });
    const first = result.current.project;
    act(() => result.current.session.loadDocument(loaded));
    expect(result.current.project).not.toBe(first);
    expect(Object.keys(result.current.project.getState().doc.clips).sort()).toEqual(["a", "b"]);
    act(() => result.current.session.newProject());
    expect(Object.keys(result.current.project.getState().doc.clips)).toEqual([]);
  });
});

describe("PlaybackProvider", () => {
  it("plays on the fallback clock and reflects transport state", () => {
    const project = makeProject();
    const clock = playbackOptions();
    const { result } = renderHook(() => usePlayback(), {
      wrapper: wrapperFor(project, (children) => <PlaybackProvider options={clock.options}>{children}</PlaybackProvider>),
    });
    expect(result.current.mode).toBe("unsupported");
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => clock.step(0));
    act(() => clock.step(500));
    expect(project.getState().playheadUs).toBe(500_000);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.seek(99 * S));
    expect(project.getState().playheadUs).toBe(4 * S); // clamped to the composition
  });

  it("stays usable under StrictMode's double effects", () => {
    const project = makeProject();
    const clock = playbackOptions();
    const { result } = renderHook(() => usePlayback(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <ProjectProvider project={project}>
            <PlaybackProvider options={clock.options}>{children}</PlaybackProvider>
          </ProjectProvider>
        </StrictMode>
      ),
    });
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.setVolume(0.3));
    expect(result.current.volume).toBe(0.3);
  });

  it("remembers the monitoring volume under a storage key", () => {
    localStorage.setItem("test:volume", "0.25");
    const project = makeProject();
    const clock = playbackOptions();
    const { result } = renderHook(() => usePlayback(), {
      wrapper: wrapperFor(project, (children) => (
        <PlaybackProvider options={clock.options} volumeStorageKey="test:volume">
          {children}
        </PlaybackProvider>
      )),
    });
    expect(result.current.volume).toBe(0.25);
    act(() => result.current.setVolume(0.8));
    expect(localStorage.getItem("test:volume")).toBe("0.8");
  });
});

describe("useEditorShortcuts", () => {
  it("deletes and splits with keys, but not while typing in a field", () => {
    const project = makeProject();
    function Keys() {
      useEditorShortcuts(["delete", "split"]);
      const input = useRef<HTMLInputElement>(null);
      return <input ref={input} data-testid="field" />;
    }
    const { getByTestId } = render(
      <ProjectProvider project={project}>
        <Keys />
      </ProjectProvider>,
    );
    act(() => project.setSelection(["a"]));
    fireEvent.keyDown(getByTestId("field"), { key: "Delete" });
    expect(project.getState().doc.clips["a"]).toBeDefined();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true }); // undo not enabled here
    fireEvent.keyDown(window, { key: "Delete" });
    expect(project.getState().doc.clips["a"]).toBeUndefined();

    act(() => {
      project.setSelection(["b"]);
      project.setPlayhead(1 * S);
    });
    fireEvent.keyDown(window, { key: "s" });
    expect(Object.values(project.getState().doc.clips).filter((c) => c.trackId === "v2")).toHaveLength(2);
  });
});
