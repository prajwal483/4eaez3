import { fireEvent, render, screen } from "@testing-library/react";
import { api, ApiError } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.decision).mockReset();
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("shows the shortfall, energy figures and forecast run in the rail", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20", anySignal);
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
    expect(screen.getAllByText("2.2 GWh")).toHaveLength(2);
    expect(screen.getByText("Thu 1 Jan, 07:30 UTC")).toBeInTheDocument();
    expect(screen.getByText(/latest before the 09:20 gate/)).toBeInTheDocument();
  });

  it("explains when there is no likely range yet", async () => {
    const points = decisionFixture.points.map((p) => ({ ...p, low_mw: null, high_mw: null }));
    vi.mocked(api.decision).mockResolvedValue({ ...decisionFixture, points });
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Not enough history yet for a likely range.")).toBeInTheDocument();
  });

  it("shows an error with a reference and a retry that refetches", async () => {
    vi.mocked(api.decision).mockRejectedValueOnce(new ApiError("boom", 500, "internal_error", "req-42"));
    render(<DecisionView deliveryDate="2026-01-15" gateTime="09:20" />);
    expect(await screen.findByText("Couldn't load the forecast for Thu 15 Jan 2026.")).toBeInTheDocument();
    expect(screen.getByText("Reference: req-42")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });

  it("keeps the last result and shows updating while refetching", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    vi.mocked(api.decision).mockReturnValue(new Promise(() => {}));
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50", anySignal);
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("Shortfall at risk (P10)")).toBeInTheDocument();
  });

  it("returns instantly to a day it has already loaded", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-03" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(screen.queryByText("Updating…")).not.toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });

  it("says so when no forecast exists for the day", async () => {
    vi.mocked(api.decision).mockResolvedValue({
      ...decisionFixture,
      points: [],
      forecast_published_at: null,
      forecast_energy_mwh: null,
      actual_energy_mwh: null,
    });
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("No forecast was published for this day before the gate.")).toBeInTheDocument();
    expect(screen.getByText(/No forecast was published before the 09:20 gate/)).toBeInTheDocument();
  });
});
