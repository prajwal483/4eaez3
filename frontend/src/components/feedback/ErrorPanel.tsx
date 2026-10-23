import s from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
  reference?: string;
}

export function ErrorPanel({ message, onRetry, reference }: ErrorPanelProps) {
  return (
    <div className={s.error} role="alert">
      <div>
        <p>{message}</p>
        {reference && <p className={s.reference}>Reference: {reference}</p>}
      </div>
      <button type="button" className={s.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
