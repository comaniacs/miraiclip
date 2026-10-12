import { useCallback, type MutableRefObject, type ReactNode, type Ref, type RefCallback } from "react";

/** One ref callback that feeds several refs (a forwarded ref plus an internal one). */
export function useMergedRef<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    }
  }, refs);
}

/** `data-*` flag: present (empty string) when true, absent otherwise. */
export const flag = (on: boolean | undefined): "" | undefined => (on ? "" : undefined);

/** Children that are either nodes or a render function of some state. */
export type RenderChildren<S> = ReactNode | ((state: S) => ReactNode);

export function renderChildren<S>(children: RenderChildren<S>, state: S): ReactNode {
  return typeof children === "function" ? (children as (state: S) => ReactNode)(state) : children;
}
