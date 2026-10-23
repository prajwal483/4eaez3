import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { api } from "./api";
import { accuracyFixture, decisionFixture, horizonFixture, metaFixture } from "./test/fixtures";

vi.mock("./api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.meta).mockResolvedValue(metaFixture);
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

it("switches between the decision and accuracy tabs", async () => {
  render(<App />);
  expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
});
