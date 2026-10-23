import { type DependencyList, useCallback, useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Loads data when deps change; keeps the previous data while refetching so views can show it dimmed. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e: Error) => !cancelled && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
