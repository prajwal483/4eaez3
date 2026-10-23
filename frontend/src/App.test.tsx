import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { api } from "./api";
import { accuracyFixture, decisionFixture, horizonFixture, metaFixture } from "./test/fixtures";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.meta).mockResolvedValue(metaFixture);
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

it("switches tabs and swaps the top-bar controls", async () => {
  render(<App />);
  expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
  expect(screen.getByLabelText("Delivery day")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  expect(screen.getByLabelText(/Forecast horizon/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Delivery day")).not.toBeInTheDocument();
});

it("steps to the next delivery day and records it in the URL", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.click(screen.getByRole("button", { name: "Next day" }));
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-03", "09:20", anySignal);
  expect(window.location.search).toContain("day=2026-01-03");
});

it("changes gate closure from the top bar", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.change(screen.getByLabelText("Gate closure on D-1"), { target: { value: "09:50" } });
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-02", "09:50", anySignal);
});

it("restores the view from a shared link", async () => {
  window.history.replaceState(null, "", "/?tab=accuracy&h=6");
  render(<App />);
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  expect(api.accuracy).toHaveBeenCalledWith(6, anySignal);
});
