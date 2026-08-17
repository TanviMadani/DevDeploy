import React from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An error occurred',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-4 rounded-lg border border-rose-900/50 bg-rose-950/20 text-xs text-rose-300 flex items-center justify-between gap-4 ${className}`}
    >
      <div>
        <span className="font-semibold text-rose-200">{title}</span>
        {message && <p className="text-rose-400/90 mt-0.5">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 text-xs border-rose-800/60 text-rose-200 hover:bg-rose-950/40">
          Retry
        </Button>
      )}
    </div>
  );
};
