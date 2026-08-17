import React, { useState, useEffect } from 'react';
import type { EnvironmentVariable } from '../../types';
import { projectsApi } from '../../api/projects.api';
import { Button } from '../ui/Button';
import { KeyIcon, TrashIcon, EyeIcon, EyeOffIcon, PlusIcon, CopyIcon, CheckIcon } from '../icons/Icons';

interface EnvironmentVariablesSectionProps {
  projectId: number;
}

export const EnvironmentVariablesSection: React.FC<EnvironmentVariablesSectionProps> = ({ projectId }) => {
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [valInput, setValInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [visibleValues, setVisibleValues] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchEnvVars = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await projectsApi.getEnvVars(projectId);
      setEnvVars(res.envVars || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load environment variables');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchEnvVars();
    }
  }, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = keyInput.trim();
    if (!trimmedKey) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await projectsApi.upsertEnvVar(projectId, trimmedKey, valInput);
      if (res.envVar) {
        setEnvVars((prev) => {
          const filtered = prev.filter((item) => item.key !== res.envVar.key);
          return [...filtered, res.envVar].sort((a, b) => a.key.localeCompare(b.key));
        });
        setKeyInput('');
        setValInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save environment variable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (envId: number) => {
    try {
      setError(null);
      await projectsApi.deleteEnvVar(projectId, envId);
      setEnvVars((prev) => prev.filter((item) => item.id !== envId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete variable');
    }
  };

  const toggleVisibility = (id: number) => {
    setVisibleValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400">
            <KeyIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Environment Variables</h3>
            <p className="text-xs text-zinc-400">
              Key-value variables injected into application build and runtime environments.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
          {envVars.length} variable{envVars.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Add Variable Form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        <input
          type="text"
          placeholder="KEY (e.g. VITE_API_URL)"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
          className="w-full sm:w-1/3 px-3 py-1.5 text-xs font-mono bg-zinc-900/90 border border-zinc-800 rounded focus:border-cyan-500 focus:outline-none text-zinc-100 placeholder-zinc-500"
          required
        />
        <input
          type="text"
          placeholder="VALUE"
          value={valInput}
          onChange={(e) => setValInput(e.target.value)}
          className="w-full sm:flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-900/90 border border-zinc-800 rounded focus:border-cyan-500 focus:outline-none text-zinc-100 placeholder-zinc-500"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isSubmitting}
          leftIcon={<PlusIcon size={14} />}
          className="w-full sm:w-auto shrink-0"
        >
          Add Variable
        </Button>
      </form>

      {/* Variables List */}
      <div className="border border-zinc-850 rounded-md overflow-hidden bg-zinc-900/30">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-zinc-500">Loading variables...</div>
        ) : envVars.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No environment variables configured yet for this project.
          </div>
        ) : (
          <div className="divide-y divide-zinc-850">
            {envVars.map((item) => {
              const isVisible = visibleValues[item.id] || false;
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 gap-3 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono text-xs font-semibold text-cyan-300 shrink-0">
                      {item.key}
                    </span>
                    <span className="text-zinc-600 font-mono text-xs">=</span>
                    <span className="font-mono text-xs text-zinc-300 truncate">
                      {isVisible ? item.value : '••••••••••••••••'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleVisibility(item.id)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title={isVisible ? 'Hide value' : 'Show value'}
                    >
                      {isVisible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.value)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Copy value"
                    >
                      {isCopied ? <CheckIcon size={14} className="text-emerald-400" /> : <CopyIcon size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors ml-1"
                      title="Delete variable"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
