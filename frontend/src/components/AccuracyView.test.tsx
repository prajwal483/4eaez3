import { render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows headline metrics for the requested horizon", async () => {
    render(<AccuracyView horizon={24} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("refetches when the horizon changes", async () => {
    const { rerender } = render(<AccuracyView horizon={24} />);
    await screen.findByText("Mean absolute error");
    rerender(<AccuracyView horizon={6} />);
    expect(api.accuracy).toHaveBeenLastCalledWith(6);
  });
});
