import type { ResolvedTrip } from "../dsl/types";
import { formatMoney, pluralizeDays } from "../lib/format";

interface SummaryProps {
  trip: ResolvedTrip;
}

export function Summary({ trip }: SummaryProps) {
  const budgets = Object.entries(trip.budgetByCurrency);

  return (
    <div className="summary">
      <div className="summary__item">
        <span className="summary__value">{trip.hops.length}</span>
        <span className="summary__label">stops</span>
      </div>
      <div className="summary__item">
        <span className="summary__value">{pluralizeDays(trip.totalDays)}</span>
        <span className="summary__label">total</span>
      </div>
      <div className="summary__item summary__item--budget">
        <span className="summary__value">
          {budgets.length === 0
            ? "—"
            : budgets
                .map(([cur, amount]) => formatMoney(amount, cur === "(unspecified)" ? "" : cur))
                .join(" · ")}
        </span>
        <span className="summary__label">budget</span>
      </div>
    </div>
  );
}
