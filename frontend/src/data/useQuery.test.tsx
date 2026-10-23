import { act, renderHook, waitFor } from "@testing-library/react";
import { clearQueryCache, useQuery } from "./useQuery";

afterEach(() => clearQueryCache());

describe("useQuery", () => {
  it("serves a cached key without refetching", async () => {
    const fetcher = vi.fn().mockResolvedValue("first");
    const one = renderHook(() => useQuery("k", fetcher));
    await waitFor(() => expect(one.result.current.data).toBe("first"));
    const two = renderHook(() => useQuery("k", fetcher));
    expect(two.result.current.data).toBe("first");
    expect(two.result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("aborts the previous request when the key changes", () => {
    const signals: AbortSignal[] = [];
    const fetcher = (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>(() => {});
    };
    const { rerender } = renderHook(({ k }) => useQuery(k, fetcher), { initialProps: { k: "a" } });
    rerender({ k: "b" });
    expect(signals[0].aborted).toBe(true);
    expect(signals[signals.length - 1].aborted).toBe(false);
  });

  it("keeps the previous data while a new key loads", async () => {
    const fetchFor = (k: string) => () => (k === "a" ? Promise.resolve("A") : new Promise<string>(() => {}));
    const { result, rerender } = renderHook(({ k }) => useQuery(k, fetchFor(k)), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.data).toBe("A"));
    rerender({ k: "b" });
    expect(result.current.data).toBe("A");
    expect(result.current.loading).toBe(true);
  });

  it("reload drops the cache entry and refetches", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const { result } = renderHook(() => useQuery("n", fetcher));
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("exposes errors as Error objects", async () => {
    const { result } = renderHook(() => useQuery("e", () => Promise.reject(new Error("nope"))));
    await waitFor(() => expect(result.current.error?.message).toBe("nope"));
    expect(result.current.loading).toBe(false);
  });
});
