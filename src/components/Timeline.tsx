import { dayDiff, formatDate } from "../lib/dates";
import { formatMoney, pluralizeDays } from "../lib/format";
import type { Money } from "../dsl/types";
import type { DisplayHop } from "./display";

interface TimelineProps {
  hops: DisplayHop[];
  activeHopId: string | null;
  onHover: (hopId: string | null) => void;
  /** Append a fresh, correctly-formed hop to the plan and focus it for renaming. */
  onAddHop: () => void;
}

interface Row {
  kind: "hop" | "stop";
  id: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  days: number;
  budget?: Money;
  /** For drive stops, the night count (drives its bar label). */
  nights?: number;
}

/** A one-click affordance to append a correctly-formed hop to the plan. */
function AddHopButton({ onAddHop }: { onAddHop: () => void }) {
  return (
    <button type="button" className="btn btn--ghost timeline__add" onClick={onAddHop}>
      + Add hop
    </button>
  );
}

export function Timeline({ hops, activeHopId, onHover, onAddHop }: TimelineProps) {
  if (hops.length === 0) {
    return (
      <div className="timeline timeline--empty">
        <span>Add a hop to see the timeline.</span>
        <AddHopButton onAddHop={onAddHop} />
      </div>
    );
  }

  // Flatten to rows, threading each hop's overnight drive stops in just before it.
  const rows: Row[] = hops.flatMap((h) => [
    ...h.driveStops.map<Row>((ds) => ({
      kind: "stop",
      id: ds.stop.id,
      name: ds.stop.name,
      color: h.color,
      startDate: ds.stop.startDate,
      endDate: ds.stop.endDate,
      days: ds.stop.days,
      nights: ds.stop.nights,
    })),
    {
      kind: "hop",
      id: h.hop.id,
      name: h.hop.name,
      color: h.color,
      startDate: h.hop.startDate,
      endDate: h.hop.endDate,
      days: h.hop.days,
      budget: h.hop.budget,
    },
  ]);

  const tripStart = rows[0].startDate;
  const tripEnd = rows[rows.length - 1].endDate;
  const span = Math.max(1, dayDiff(tripStart, tripEnd));

  return (
    <div className="timeline">
      <div className="timeline__axis">
        <span>{formatDate(tripStart)}</span>
        <span>{formatDate(tripEnd)}</span>
      </div>
      <div className="timeline__rows">
        {rows.map((r) => {
          const offset = dayDiff(tripStart, r.startDate);
          const width = Math.max(r.days, 0.6);
          const left = (offset / span) * 100;
          const widthPct = (width / span) * 100;
          const isStop = r.kind === "stop";
          const active = !isStop && r.id === activeHopId;
          return (
            <div
              key={r.id}
              className={
                `timeline__row${active ? " timeline__row--active" : ""}` +
                (isStop ? " timeline__row--stop" : "")
              }
              onMouseEnter={() => onHover(isStop ? null : r.id)}
              onMouseLeave={() => onHover(null)}
            >
              <div className="timeline__label">
                <span className="timeline__dot" style={{ background: r.color }} />
                <span className="timeline__name">{r.name}</span>
                {isStop && <span className="timeline__tag">drive</span>}
              </div>
              <div className="timeline__track">
                <div
                  className="timeline__bar"
                  style={{
                    left: `${left}%`,
                    width: `${widthPct}%`,
                    background: r.color,
                  }}
                  title={`${formatDate(r.startDate)} – ${formatDate(r.endDate)}`}
                >
                  <span className="timeline__bar-text">
                    {isStop
                      ? `${r.nights} night${r.nights === 1 ? "" : "s"}`
                      : pluralizeDays(r.days)}
                  </span>
                </div>
              </div>
              <div className="timeline__meta">
                {r.budget ? formatMoney(r.budget.amount, r.budget.currency) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="timeline__footer">
        <AddHopButton onAddHop={onAddHop} />
      </div>
    </div>
  );
}
