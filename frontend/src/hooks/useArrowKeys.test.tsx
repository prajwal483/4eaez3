import { fireEvent, render } from "@testing-library/react";
import { useArrowKeys } from "./useArrowKeys";

function Harness({ onPrev, onNext, enabled }: { onPrev: () => void; onNext: () => void; enabled: boolean }) {
  useArrowKeys(onPrev, onNext, enabled);
  return <input aria-label="field" />;
}

describe("useArrowKeys", () => {
  it("calls prev and next for the arrow keys", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<Harness onPrev={onPrev} onNext={onNext} enabled />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("ignores keys typed into form fields, with modifiers, or when disabled", () => {
    const onNext = vi.fn();
    const { getByLabelText, rerender } = render(<Harness onPrev={vi.fn()} onNext={onNext} enabled />);
    fireEvent.keyDown(getByLabelText("field"), { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    rerender(<Harness onPrev={vi.fn()} onNext={onNext} enabled={false} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
  });
});
