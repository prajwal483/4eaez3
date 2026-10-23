import { fireEvent, render, screen } from "@testing-library/react";
import { DayStepper } from "./DayStepper";

const days = ["2026-01-02", "2026-01-03", "2026-01-04"];

describe("DayStepper", () => {
  it("steps forward and back", () => {
    const onChange = vi.fn();
    render(<DayStepper days={days} value="2026-01-03" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-01-04");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-01-02");
  });

  it("disables stepping past either end", () => {
    const { rerender } = render(<DayStepper days={days} value="2026-01-02" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous day" })).toBeDisabled();
    rerender(<DayStepper days={days} value="2026-01-04" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  it("labels days in words and picks from the list", () => {
    const onChange = vi.fn();
    render(<DayStepper days={days} value="2026-01-02" onChange={onChange} />);
    expect(screen.getByRole("option", { name: "Fri 2 Jan 2026" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Delivery day"), { target: { value: "2026-01-04" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-01-04");
  });
});
