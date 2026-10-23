import { useCallback, useEffect, useState } from "react";

// Fixed snapshot, so cached results never go stale within a session.
const cache = new Map<string, unknown>();

export function clearQueryCache(): void {
  cache.clear();
}

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<QueryResult<T>>(() =>
    cache.has(key)
      ? { data: cache.get(key) as T, error: null, loading: false }
      : { data: null, error: null, loading: true },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ data: cache.get(key) as T, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => {
        cache.set(key, data);
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false }));
      });
    return () => controller.abort();
    // The fetcher changes every render; the key captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    cache.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  return { ...state, reload };
}
