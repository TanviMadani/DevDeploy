import React, { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { Button } from '../ui/Button';
import { LogoIcon, AlertTriangleIcon } from '../icons/Icons';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }
    if (!password) {
      setFormError('Password is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email: email.trim(), password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-850 rounded-md p-6 shadow-none">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 mb-3 text-zinc-100">
          <LogoIcon size={20} />
        </div>
        <h2 className="text-sm font-semibold text-zinc-100 tracking-tight font-mono">
          Sign In to DevDeploy
        </h2>
      </div>

      {/* Error Alert */}
      {(formError || error) && (
        <div className="mb-4 p-2.5 rounded-md bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangleIcon size={14} className="text-rose-400 shrink-0" />
          <span>{formError || error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="developer@domain.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-zinc-600 h-8 transition-colors"
          />
        </div>

        <div>
          <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formError) setFormError(null);
            }}
            className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-zinc-600 h-8 transition-colors"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          className="w-full h-8 text-xs font-medium mt-1"
        >
          Sign In
        </Button>
      </form>

      {/* Switch to Register */}
      <div className="mt-5 pt-4 border-t border-zinc-900 text-center text-xs text-zinc-500 font-mono">
        <span>No account? </span>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-zinc-300 hover:text-white underline-offset-2 hover:underline cursor-pointer"
        >
          Create one
        </button>
      </div>
    </div>
  );
};
