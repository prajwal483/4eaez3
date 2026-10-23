import { useId } from "react";
import s from "./HorizonSlider.module.css";

interface HorizonSliderProps {
  value: number;
  max: number;
  onChange: (hours: number) => void;
}

export function HorizonSlider({ value, max, onChange }: HorizonSliderProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        Forecast horizon
      </label>
      <input
        id={id}
        className={s.range}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className={s.value}>
        {value} h ahead
      </output>
    </div>
  );
}
