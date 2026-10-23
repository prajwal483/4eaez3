import { useEffect } from "react";

const FORM_FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

export function useArrowKeys(onPrev: () => void, onNext: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if ((target && FORM_FIELDS.has(target.tagName)) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, enabled]);
}
