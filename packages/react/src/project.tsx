import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createProject, type Project, type ProjectDocument, type ProjectSettings } from "@miraiclip/core";

const ProjectContext = createContext<Project | null>(null);

export type ProjectProviderProps =
  | {
      /** Settings for a fresh project, or a serialized document to restore. */
      init: ProjectSettings | ProjectDocument;
      /** Populate a fresh project once (e.g. a demo). Its edits are not undoable. */
      seed?: (project: Project) => void;
      project?: never;
      children: ReactNode;
    }
  | {
      /** A project you created yourself (`createProject`). */
      project: Project;
      init?: never;
      seed?: never;
      children: ReactNode;
    };

/**
 * Provides one Miraiclip project to everything below it. Pass `init` (and
 * optionally `seed`) to have the provider create the project once for its
 * lifetime, or `project` to share one you created.
 */
export function ProjectProvider(props: ProjectProviderProps) {
  const external = props.project;
  const [created] = useState<Project | null>(() => {
    if (external || !props.init) return null;
    const project = createProject(props.init);
    props.seed?.(project);
    // A freshly seeded project should not let the user "undo" the seed.
    project.clearHistory();
    return project;
  });
  const project = external ?? created;
  if (!project) throw new Error("<ProjectProvider> needs `init` or `project`");
  return <ProjectContext.Provider value={project}>{props.children}</ProjectContext.Provider>;
}

/** The project from the nearest `<ProjectProvider>`. */
export function useProject(): Project {
  const project = useContext(ProjectContext);
  if (!project) throw new Error("useProject must be used within <ProjectProvider>");
  return project;
}

export interface SessionInit {
  init: ProjectSettings | ProjectDocument;
  seed?: (project: Project) => void;
}

export interface ProjectSession {
  /** Replace the current composition with a serialized document (Open). */
  loadDocument: (doc: ProjectDocument) => void;
  /** Start over from the initial project (New). */
  newProject: () => void;
}

const SessionContext = createContext<ProjectSession | null>(null);

/**
 * A `<ProjectProvider>` whose project can be swapped at runtime (Open / New).
 * Loading remounts everything below it, so engine, renderer and UI all
 * re-initialize cleanly from the loaded state.
 */
export function ProjectSessionProvider({ initial, children }: { initial: SessionInit; children: ReactNode }) {
  const [session, setSession] = useState<{ init: SessionInit; version: number }>({ init: initial, version: 0 });

  const loadDocument = useCallback((doc: ProjectDocument) => {
    setSession((s) => ({ init: { init: doc }, version: s.version + 1 }));
  }, []);
  const newProject = useCallback(() => {
    setSession((s) => ({ init: initial, version: s.version + 1 }));
  }, [initial]);

  const value = useMemo<ProjectSession>(() => ({ loadDocument, newProject }), [loadDocument, newProject]);
  const { init, seed } = session.init;
  return (
    <SessionContext.Provider value={value}>
      <ProjectProvider key={session.version} init={init} {...(seed ? { seed } : {})}>
        {children}
      </ProjectProvider>
    </SessionContext.Provider>
  );
}

/** Open / New for the nearest `<ProjectSessionProvider>`. */
export function useProjectSession(): ProjectSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useProjectSession must be used within <ProjectSessionProvider>");
  return session;
}
