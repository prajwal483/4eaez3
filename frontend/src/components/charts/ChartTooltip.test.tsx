import { render, screen } from "@testing-library/react";
import { ChartTooltip } from "./ChartTooltip";

type Row = { startTime: string };
const row: Row = { startTime: "2026-01-15T14:00:00Z" };

describe("ChartTooltip", () => {
  it("renders a title and one line per series", () => {
    render(
      <ChartTooltip<Row>
        active
        payload={[{ payload: row }]}
        title={() => "Thu 15 Jan, 14:00"}
        lines={() => [
          { label: "Forecast", value: "15.8 GW", color: "#1f5fbf" },
          { label: "Outturn", value: "14.6 GW", color: "#3d3d3a", kind: "dashed" },
        ]}
      />,
    );
    expect(screen.getByText("Thu 15 Jan, 14:00")).toBeInTheDocument();
    expect(screen.getByText("15.8 GW")).toBeInTheDocument();
    expect(screen.getByText("Outturn")).toBeInTheDocument();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(
      <ChartTooltip<Row> active={false} payload={[{ payload: row }]} title={() => "x"} lines={() => []} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
