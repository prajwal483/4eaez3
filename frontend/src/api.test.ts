import { api } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("calls the versioned decision endpoint", async () => {
    const fetchMock = mockFetch({ points: [] });
    await api.decision("2026-01-15", "09:20");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decision?delivery_date=2026-01-15&gate_time=09%3A20");
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meta");
  });
  it("surfaces the error envelope message", async () => {
    mockFetch({ error: { code: "out_of_window", message: "delivery_date must be between 2026-01-02 and 2026-02-01" } }, false, 400);
    await expect(api.decision("2026-03-01", "09:20")).rejects.toThrow("delivery_date must be between");
  });
  it("falls back to the status code when the body has no error envelope", async () => {
    mockFetch({ detail: "upstream" }, false, 502);
    await expect(api.accuracy(24)).rejects.toThrow("Request failed: 502");
  });
});
