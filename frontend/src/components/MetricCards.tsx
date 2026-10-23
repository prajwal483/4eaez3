export interface Card {
  label: string;
  value: string;
  hint?: string;
}

export function MetricCards({ cards }: { cards: Card[] }) {
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="card-label">{c.label}</div>
          <div className="card-value">{c.value}</div>
          {c.hint && <div className="card-hint">{c.hint}</div>}
        </div>
      ))}
    </div>
  );
}
