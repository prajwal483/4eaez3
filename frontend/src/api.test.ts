import { api } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("builds the decision query string", async () => {
    const fetchMock = mockFetch({ points: [] });
    await api.decision("2026-01-15", "09:20");
    expect(fetchMock).toHaveBeenCalledWith("/api/decision?delivery_date=2026-01-15&gate_time=09%3A20");
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/meta");
  });
  it("surfaces the backend error detail", async () => {
    mockFetch({ detail: "delivery_date must be between 2026-01-02 and 2026-02-01" }, false, 400);
    await expect(api.decision("2026-03-01", "09:20")).rejects.toThrow("delivery_date must be between");
  });
  it("falls back to the status code when there is no string detail", async () => {
    mockFetch({ detail: [{ msg: "bad" }] }, false, 422);
    await expect(api.accuracy(99)).rejects.toThrow("Request failed: 422");
  });
});
