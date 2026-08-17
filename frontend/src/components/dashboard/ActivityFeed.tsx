import React from 'react';
import type { ActivityEvent } from '../../types';

export interface ActivityFeedProps {
  activities: ActivityEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500 font-mono">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-900 font-mono text-xs">
      {activities.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-900/40 transition-colors"
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                item.type === 'deploy_success'
                  ? 'bg-emerald-400'
                  : item.type === 'deploy_failed'
                  ? 'bg-rose-400'
                  : 'bg-sky-400'
              }`}
            />
            <span className="font-sans font-medium text-zinc-200 truncate">
              {item.projectName}
            </span>
            <span className="text-zinc-500 text-[11px] truncate hidden sm:inline">
              {item.details}
            </span>
          </div>

          <span className="text-[11px] text-zinc-600 shrink-0">
            {item.timestamp}
          </span>
        </div>
      ))}
    </div>
  );
};
