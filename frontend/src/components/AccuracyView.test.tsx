import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture, metaFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows headline metrics for the default 24 h horizon", async () => {
    render(<AccuracyView meta={metaFixture} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("refetches when the horizon slider moves", async () => {
    render(<AccuracyView meta={metaFixture} />);
    await screen.findByText("Mean absolute error");
    fireEvent.change(screen.getByLabelText(/Forecast horizon/), { target: { value: "6" } });
    expect(api.accuracy).toHaveBeenLastCalledWith(6);
  });
});
