import "@testing-library/jest-dom/vitest";
import { clearQueryCache } from "./data/useQuery";

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(() => {
  clearQueryCache();
  window.history.replaceState(null, "", "/");
});
