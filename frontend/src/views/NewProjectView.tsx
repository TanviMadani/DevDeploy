import React, { useState } from 'react';
import type { CreateProjectRequest } from '../api/types';
import { Button } from '../components/ui/Button';
import { AlertTriangleIcon } from '../components/icons/Icons';

interface NewProjectViewProps {
  onSubmit: (data: CreateProjectRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const NewProjectView: React.FC<NewProjectViewProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [rootDirectory, setRootDirectory] = useState('');
  const [buildCommand, setBuildCommand] = useState('');
  const [startCommand, setStartCommand] = useState('');

  const [errors, setErrors] = useState<{
    name?: string;
    repositoryUrl?: string;
    general?: string;
  }>({});

  const validate = () => {
    const newErrors: { name?: string; repositoryUrl?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Project name is required.';
    }

    if (!repositoryUrl.trim()) {
      newErrors.repositoryUrl = 'Repository URL is required.';
    } else if (!/^https:\/\/github\.com\/[\w-]+\/[\w.-]+/.test(repositoryUrl.trim())) {
      newErrors.repositoryUrl =
        'Enter a valid GitHub URL (e.g. https://github.com/org/repo).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        repositoryUrl: repositoryUrl.trim(),
        autoDeploy,
        rootDirectory: rootDirectory.trim() || undefined,
        buildCommand: buildCommand.trim() || undefined,
        startCommand: startCommand.trim() || undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create project.';
      setErrors((prev) => ({
        ...prev,
        general: msg,
      }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            New Project
          </h2>
          <p className="text-xs text-zinc-500 font-mono">
            Connect a GitHub repository to configure continuous deployments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* General Error Banner */}
      {errors.general && (
        <div className="p-3 rounded-md bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangleIcon size={14} className="text-rose-400 shrink-0" />
          <span>{errors.general}</span>
        </div>
      )}

      {/* Minimal Form */}
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Section 1: Repository Info */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 space-y-3.5">
          <span className="text-[11px] font-semibold text-zinc-300 font-mono uppercase tracking-wider block">
            Repository
          </span>

          <div>
            <label className="block text-zinc-300 font-medium mb-1" htmlFor="repositoryUrl">
              GitHub Repository URL <span className="text-rose-400">*</span>
            </label>
            <input
              id="repositoryUrl"
              type="url"
              required
              placeholder="https://github.com/owner/repository"
              value={repositoryUrl}
              onChange={(e) => {
                setRepositoryUrl(e.target.value);
                if (errors.repositoryUrl) setErrors((prev) => ({ ...prev, repositoryUrl: undefined }));
              }}
              className={`w-full px-3 py-1.5 bg-zinc-950 border rounded-md text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-none h-8 transition-colors ${
                errors.repositoryUrl
                  ? 'border-rose-500/80'
                  : 'border-zinc-800 focus:border-zinc-600'
              }`}
            />
            {errors.repositoryUrl && (
              <p className="text-rose-400 text-[11px] mt-1">{errors.repositoryUrl}</p>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1" htmlFor="projectName">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="projectName"
              type="text"
              required
              placeholder="my-project"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full px-3 py-1.5 bg-zinc-950 border rounded-md text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-none h-8 transition-colors ${
                errors.name
                  ? 'border-rose-500/80'
                  : 'border-zinc-800 focus:border-zinc-600'
              }`}
            />
            {errors.name && (
              <p className="text-rose-400 text-[11px] mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1" htmlFor="projectDesc">
              Description (Optional)
            </label>
            <input
              id="projectDesc"
              type="text"
              placeholder="Brief description of the service"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 h-8"
            />
          </div>
        </div>

        {/* Section 2: Build & Runtime Config */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 space-y-3.5">
          <span className="text-[11px] font-semibold text-zinc-300 font-mono uppercase tracking-wider block">
            Build & Output
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px]" htmlFor="rootDirectory">
                Root Directory
              </label>
              <input
                id="rootDirectory"
                type="text"
                placeholder="./"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-zinc-600 h-8"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px]" htmlFor="buildCommand">
                Build Command
              </label>
              <input
                id="buildCommand"
                type="text"
                placeholder="npm run build"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-zinc-600 h-8"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px]" htmlFor="startCommand">
                Start Command
              </label>
              <input
                id="startCommand"
                type="text"
                placeholder="npm start"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-zinc-600 h-8"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Automation Settings */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-zinc-200 block">
              Automatic Deployments
            </span>
            <p className="text-[11px] text-zinc-500 font-mono">
              Automatically trigger deployments on git push events
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoDeploy}
              onChange={(e) => setAutoDeploy(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-200"></div>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
          >
            Create Project
          </Button>
        </div>
      </form>
    </div>
  );
};
