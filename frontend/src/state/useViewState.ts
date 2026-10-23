import { useCallback, useEffect, useState } from "react";
import { readViewState, toSearch, type ViewLimits, type ViewState } from "./viewState";

/** View state that lives in the URL, so links can be shared and a refresh keeps the view. */
export function useViewState(limits: ViewLimits) {
  const [state, setState] = useState<ViewState>(() => readViewState(window.location.search, limits));

  useEffect(() => {
    window.history.replaceState(null, "", toSearch(state));
  }, [state]);

  const update = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), []);
  return [state, update] as const;
}
