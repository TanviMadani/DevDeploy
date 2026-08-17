import React, { useState } from 'react';
import type { Project } from '../../types';
import { Button } from '../ui/Button';
import { XIcon } from '../icons/Icons';

export interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: Partial<Project>) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [startCommand, setStartCommand] = useState('npm start');
  const [rootDirectory, setRootDirectory] = useState('./');
  const [autoDeploy, setAutoDeploy] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !repositoryUrl) return;

    onCreateProject({
      name,
      description,
      repositoryUrl,
      branch,
      buildCommand,
      startCommand,
      rootDirectory,
      autoDeploy,
      framework: 'Node.js',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-zinc-950 border border-zinc-850 rounded-md w-full max-w-lg shadow-none overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/40">
          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
            New Project
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition-colors"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">
              Repository URL <span className="text-rose-400">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://github.com/org/repo"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">Branch</label>
              <input
                type="text"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">Root Directory</label>
              <input
                type="text"
                placeholder="./"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">Build Command</label>
              <input
                type="text"
                placeholder="npm run build"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1 font-mono text-[11px]">Start Command</label>
              <input
                type="text"
                placeholder="npm start"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono h-8"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1 text-[11px]">Description</label>
            <input
              type="text"
              placeholder="Optional service summary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 h-8"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
            <input
              type="checkbox"
              id="autoDeploy"
              checked={autoDeploy}
              onChange={(e) => setAutoDeploy(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-800 accent-zinc-200"
            />
            <label htmlFor="autoDeploy" className="text-zinc-400 select-none cursor-pointer">
              Auto-deploy on git push
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-zinc-850 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
            >
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
