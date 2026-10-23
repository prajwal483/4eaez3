import { api, ApiError } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("calls the versioned decision endpoint and forwards the abort signal", async () => {
    const fetchMock = mockFetch({ points: [] });
    const controller = new AbortController();
    await api.decision("2026-01-15", "09:20", controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decision?delivery_date=2026-01-15&gate_time=09%3A20", {
      signal: controller.signal,
    });
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meta", { signal: undefined });
  });
  it("throws ApiError with code and request id from the envelope", async () => {
    mockFetch({ error: { code: "out_of_window", message: "delivery_date must be between", request_id: "abc123" } }, false, 400);
    const error = await api.decision("2026-03-01", "09:20").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "delivery_date must be between", status: 400, code: "out_of_window", requestId: "abc123" });
  });
  it("falls back to the status code when the body has no error envelope", async () => {
    mockFetch({ detail: "upstream" }, false, 502);
    await expect(api.accuracy(24)).rejects.toThrow("Request failed: 502");
  });
});
