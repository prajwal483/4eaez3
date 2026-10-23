import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture, metaFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("loads the first delivery day at the default gate closure", async () => {
    render(<DecisionView meta={metaFixture} />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", 11);
    // (1000-800) + (1200-900) = 500 MWh
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01 09:30 UTC")).toBeInTheDocument();
  });

  it("refetches when the delivery day changes", async () => {
    render(<DecisionView meta={metaFixture} />);
    await screen.findByText("Shortfall at risk (P10)");
    fireEvent.change(screen.getByLabelText("Delivery day"), { target: { value: "2026-01-15" } });
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", 11);
  });

  it("shows backend errors", async () => {
    vi.mocked(api.decision).mockRejectedValue(new Error("boom"));
    render(<DecisionView meta={metaFixture} />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
