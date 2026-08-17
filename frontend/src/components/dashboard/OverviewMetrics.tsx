import React from 'react';
import type { MetricCardData } from '../../types';

export interface OverviewMetricsProps {
  metrics: MetricCardData[];
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-zinc-950 border border-zinc-800/80 rounded-md p-3"
        >
          <span className="text-[11px] text-zinc-500 font-mono block uppercase tracking-wider">
            {metric.title}
          </span>
          <div className="text-xl font-semibold font-mono tracking-tight text-zinc-100 mt-1">
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
};
