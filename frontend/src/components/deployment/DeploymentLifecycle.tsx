import React from 'react';
import type { DeploymentStatus } from '../../types';

interface DeploymentLifecycleProps {
  status: DeploymentStatus;
  createdAt?: string;
  updatedAt?: string;
  duration?: string;
}

export const DeploymentLifecycle: React.FC<DeploymentLifecycleProps> = ({
  status,
  duration,
}) => {
  const steps: {
    key: 'PENDING' | 'BUILDING' | 'RUNNING';
    label: string;
  }[] = [
    {
      key: 'PENDING',
      label: 'Queued',
    },
    {
      key: 'BUILDING',
      label: 'Building',
    },
    {
      key: 'RUNNING',
      label: 'Serving',
    },
  ];

  const getStepState = (
    stepKey: 'PENDING' | 'BUILDING' | 'RUNNING'
  ): 'completed' | 'current' | 'failed' | 'upcoming' => {
    if (status === 'FAILED') {
      if (stepKey === 'PENDING') return 'completed';
      if (stepKey === 'BUILDING') return 'failed';
      return 'upcoming';
    }

    if (status === 'STOPPED' || status === 'CANCELLED') {
      if (stepKey === 'PENDING') return 'completed';
      return 'upcoming';
    }

    if (status === 'PENDING') {
      return stepKey === 'PENDING' ? 'current' : 'upcoming';
    }

    if (status === 'BUILDING') {
      if (stepKey === 'PENDING') return 'completed';
      if (stepKey === 'BUILDING') return 'current';
      return 'upcoming';
    }

    if (status === 'RUNNING' || status === 'SUCCESS') {
      return 'completed';
    }

    return 'upcoming';
  };

  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
      {/* Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, index) => {
          const state = getStepState(step.key);

          return (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
                  state === 'completed'
                    ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30'
                    : state === 'current'
                    ? 'bg-sky-950/30 text-sky-400 border-sky-800/40 animate-pulse'
                    : state === 'failed'
                    ? 'bg-rose-950/30 text-rose-400 border-rose-800/30'
                    : 'bg-zinc-900/40 text-zinc-600 border-zinc-850'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    state === 'completed'
                      ? 'bg-emerald-400'
                      : state === 'current'
                      ? 'bg-sky-400'
                      : state === 'failed'
                      ? 'bg-rose-400'
                      : 'bg-zinc-700'
                  }`}
                />
                <span className="font-semibold text-[11px] uppercase tracking-wide">
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <span className="text-zinc-700 select-none">→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Duration */}
      {duration && (
        <div className="text-[11px] text-zinc-500 font-mono">
          Duration: <span className="text-zinc-300 font-semibold">{duration}</span>
        </div>
      )}
    </div>
  );
};
