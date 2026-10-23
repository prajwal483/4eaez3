import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockReset();
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("shows the shortfall, energy figures and forecast run in the rail", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20");
    // (1000-800) + (1200-900) = 500 MWh
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
    expect(screen.queryByText("Shortfall at risk (P10)")).not.toBeInTheDocument();
  });

  it("shows an error with a retry that refetches", async () => {
    vi.mocked(api.decision).mockRejectedValueOnce(new Error("boom"));
    render(<DecisionView deliveryDate="2026-01-15" gateTime="09:20" />);
    expect(await screen.findByText("Couldn't load the forecast for Thu 15 Jan 2026.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });

  it("keeps the last result and shows updating while refetching", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    vi.mocked(api.decision).mockReturnValue(new Promise(() => {}));
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50");
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("Shortfall at risk (P10)")).toBeInTheDocument();
  });
});
