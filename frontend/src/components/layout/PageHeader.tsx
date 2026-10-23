import s from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  status?: string;
}

export function PageHeader({ title, description, status }: PageHeaderProps) {
  return (
    <div className={s.header}>
      <h1 className={s.title}>{title}</h1>
      {status && (
        <span className={s.status} role="status">
          {status}
        </span>
      )}
      {description && <p className={s.description}>{description}</p>}
    </div>
  );
}
