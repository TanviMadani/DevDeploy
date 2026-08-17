import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  hoverable = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden transition-colors ${
        hoverable ? 'hover:border-zinc-750' : ''
      } ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-4 py-2.5 border-b border-zinc-850 flex items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-2 bg-zinc-900/30 border-t border-zinc-850 text-xs text-zinc-500">
          {footer}
        </div>
      )}
    </div>
  );
};
