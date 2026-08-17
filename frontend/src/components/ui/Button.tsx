import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer';

  const variants = {
    primary:
      'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 border border-transparent shadow-none',
    secondary:
      'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white active:bg-zinc-850 border border-zinc-800 shadow-none',
    outline:
      'bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white active:bg-zinc-850 border border-zinc-800 shadow-none',
    ghost:
      'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 shadow-none',
    danger:
      'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 active:bg-rose-900/70 border border-rose-800/50 shadow-none',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1.5 h-7',
    md: 'text-xs px-3 py-1.5 gap-2 h-8',
    lg: 'text-sm px-4 py-2 gap-2 h-9',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
