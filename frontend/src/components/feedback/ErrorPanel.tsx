import s from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className={s.error} role="alert">
      <p>{message}</p>
      <button type="button" className={s.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
