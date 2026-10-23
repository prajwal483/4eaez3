import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("updates only after the value stops changing", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 150), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    rerender({ v: 3 });
    act(() => vi.advanceTimersByTime(149));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(3);
  });
});
