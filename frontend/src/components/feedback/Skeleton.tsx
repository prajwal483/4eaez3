import s from "./Skeleton.module.css";

export function Skeleton({ height, width = "100%" }: { height: number; width?: number | string }) {
  return <div className={s.skeleton} style={{ height, width }} aria-hidden="true" />;
}
