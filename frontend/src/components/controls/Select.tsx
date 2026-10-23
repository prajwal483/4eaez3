import { useId } from "react";
import { ChevronDown } from "../icons";
import s from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
}

export function Select({ label, value, options, onChange, hideLabel }: SelectProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
      </label>
      <div className={s.wrap}>
        <select id={id} className={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className={s.chevron} />
      </div>
    </div>
  );
}
