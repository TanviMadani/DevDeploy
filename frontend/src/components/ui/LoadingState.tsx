import React from 'react';

export interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'cards';
  count?: number;
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  count = 3,
  message = 'Loading...',
  className = '',
}) => {
  if (type === 'skeleton') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-md border border-neutral-850 bg-neutral-900/30 animate-pulse flex items-center justify-between"
          >
            <div className="h-4 bg-neutral-800 rounded w-1/4" />
            <div className="h-4 bg-neutral-800 rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-8 text-neutral-500 text-xs font-mono gap-2 ${className}`}>
      <div className="w-3.5 h-3.5 border border-neutral-500 border-t-transparent rounded-full animate-spin" />
      <span>{message}</span>
    </div>
  );
};
