import React from 'react';
import type { DeploymentStatus } from '../../types';

interface StatusBadgeProps {
  status: DeploymentStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  DeploymentStatus,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    dotBg: string;
  }
> = {
  PENDING: {
    label: 'QUEUED',
    bg: 'bg-amber-950/30',
    text: 'text-amber-400',
    border: 'border-amber-800/30',
    dotBg: 'bg-amber-400',
  },
  BUILDING: {
    label: 'BUILDING',
    bg: 'bg-sky-950/30',
    text: 'text-sky-400',
    border: 'border-sky-800/30',
    dotBg: 'bg-sky-400',
  },
  RUNNING: {
    label: 'READY',
    bg: 'bg-emerald-950/30',
    text: 'text-emerald-400',
    border: 'border-emerald-800/30',
    dotBg: 'bg-emerald-400',
  },
  SUCCESS: {
    label: 'READY',
    bg: 'bg-emerald-950/30',
    text: 'text-emerald-400',
    border: 'border-emerald-800/30',
    dotBg: 'bg-emerald-400',
  },
  FAILED: {
    label: 'FAILED',
    bg: 'bg-rose-950/30',
    text: 'text-rose-400',
    border: 'border-rose-800/30',
    dotBg: 'bg-rose-400',
  },
  STOPPED: {
    label: 'STOPPED',
    bg: 'bg-zinc-900/60',
    text: 'text-zinc-400',
    border: 'border-zinc-800',
    dotBg: 'bg-zinc-500',
  },
  CANCELLED: {
    label: 'CANCELLED',
    bg: 'bg-zinc-900/60',
    text: 'text-zinc-400',
    border: 'border-zinc-800',
    dotBg: 'bg-zinc-500',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showPulse = true,
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs px-3 py-1 gap-2',
  }[size];

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  }[size];

  const isAnimated = showPulse && (status === 'BUILDING' || status === 'PENDING');

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border tracking-wide uppercase ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span className={`inline-block rounded-full shrink-0 ${dotSize} ${config.dotBg} ${isAnimated ? 'animate-pulse' : ''}`} />
      <span>{config.label}</span>
    </span>
  );
};
