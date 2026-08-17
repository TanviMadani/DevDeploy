import React, { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { Button } from '../ui/Button';
import { LogoIcon, AlertTriangleIcon } from '../icons/Icons';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!name.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({ name: name.trim(), email: email.trim(), password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
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
          Create DevDeploy Account
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
          <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]" htmlFor="reg-name">
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            placeholder="Alex Rivera"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (formError) setFormError(null);
            }}
            className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-zinc-600 h-8 transition-colors"
          />
        </div>

        <div>
          <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
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
          <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]" htmlFor="reg-password">
            Password (min 6 characters)
          </label>
          <input
            id="reg-password"
            type="password"
            required
            autoComplete="new-password"
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
          Create Account
        </Button>
      </form>

      {/* Switch to Login */}
      <div className="mt-5 pt-4 border-t border-zinc-900 text-center text-xs text-zinc-500 font-mono">
        <span>Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-zinc-300 hover:text-white underline-offset-2 hover:underline cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </div>
  );
};
