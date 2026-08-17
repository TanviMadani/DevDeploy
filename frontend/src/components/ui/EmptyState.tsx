import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 ${className}`}
    >
      <p className="text-xs text-zinc-400 font-medium">{title}</p>
      {description && <p className="text-xs text-zinc-500 max-w-xs mt-1 mb-3">{description}</p>}
      {actionLabel && onAction && (
        <div className={description ? '' : 'mt-3'}>
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
