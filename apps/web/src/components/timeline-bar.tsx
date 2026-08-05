"use client";

import type { TimelineReportDto } from "@frota/shared";
import { TIMELINE_COLORS, TIMELINE_LABELS } from "@frota/shared";

type Props = {
  timeline: TimelineReportDto | null;
};

export function TimelineBar({ timeline }: Props) {
  if (!timeline || timeline.segments.length === 0) {
    return <p className="muted">Sem dados para linha do tempo no período.</p>;
  }

  const totalMin = Object.values(timeline.totals).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="timeline-bar-wrap">
      <div className="timeline-bar">
        {timeline.segments.map((seg, i) => (
          <div
            key={`${seg.type}-${seg.startedAt}-${i}`}
            className="timeline-segment"
            style={{
              flex: seg.durationMin || 1,
              background: TIMELINE_COLORS[seg.type],
            }}
            title={`${TIMELINE_LABELS[seg.type]} — ${seg.durationMin} min`}
          />
        ))}
      </div>
      <div className="timeline-legend">
        {(Object.keys(TIMELINE_LABELS) as Array<keyof typeof TIMELINE_LABELS>).map((type) => {
          const min = timeline.totals[type];
          if (!min) return null;
          const pct = Math.round((min / totalMin) * 100);
          return (
            <span key={type} className="timeline-legend-item">
              <i style={{ background: TIMELINE_COLORS[type] }} />
              {TIMELINE_LABELS[type]} — {min} min ({pct}%)
            </span>
          );
        })}
      </div>
      <p className="muted timeline-summary">
        {timeline.summary.distanceKm} km · vel. máx {timeline.summary.maxSpeedKmh} km/h
      </p>
    </div>
  );
}
