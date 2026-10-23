import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.accuracy).mockReset();
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows the metric strip for the requested horizon", async () => {
    render(<AccuracyView horizon={24} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24, anySignal);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(screen.getByText(/at least 24 h before each hour/)).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("keeps results and shows updating while a new horizon loads", async () => {
    const { rerender } = render(<AccuracyView horizon={24} />);
    await screen.findByText("Mean absolute error");
    vi.mocked(api.accuracy).mockReturnValue(new Promise(() => {}));
    rerender(<AccuracyView horizon={6} />);
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("512 MW")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(api.accuracy).mockRejectedValueOnce(new Error("boom"));
    render(<AccuracyView horizon={12} />);
    expect(await screen.findByText("Couldn't load accuracy for the 12 h horizon.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  });
});
