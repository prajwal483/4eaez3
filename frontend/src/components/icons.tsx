interface IconProps {
  className?: string;
}

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function WindMark({ className }: IconProps) {
  return (
    <svg {...base} width={22} height={22} className={className}>
      <path d="M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24" />
      <path d="M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24" />
      <path d="M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24" />
    </svg>
  );
}

export function ChevronDown({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} className={className}>
      <path d="M6 9l6 6l6 -6" />
    </svg>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}
