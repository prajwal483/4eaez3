import { formatDayLong } from "../../format";
import { ChevronLeft, ChevronRight } from "../icons";
import s from "./DayStepper.module.css";
import { Select } from "./Select";

interface DayStepperProps {
  days: string[];
  value: string;
  onChange: (day: string) => void;
}

export function DayStepper({ days, value, onChange }: DayStepperProps) {
  const index = days.indexOf(value);
  return (
    <div className={s.stepper}>
      <button
        type="button"
        className={s.step}
        aria-label="Previous day"
        disabled={index <= 0}
        onClick={() => onChange(days[index - 1])}
      >
        <ChevronLeft />
      </button>
      <Select
        label="Delivery day"
        hideLabel
        value={value}
        options={days.map((d) => ({ value: d, label: formatDayLong(d) }))}
        onChange={onChange}
      />
      <button
        type="button"
        className={s.step}
        aria-label="Next day"
        disabled={index >= days.length - 1}
        onClick={() => onChange(days[index + 1])}
      >
        <ChevronRight />
      </button>
    </div>
  );
}
