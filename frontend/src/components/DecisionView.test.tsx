import { render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("loads the requested day and gate", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20");
    // (1000-800) + (1200-900) = 500 MWh
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
  });

  it("refetches when its inputs change", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50");
  });
});
