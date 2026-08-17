import React from 'react';
import type { Project } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  XIcon,
  GitHubIcon,
  GitBranchIcon,
  PlayIcon,
  ExternalLinkIcon,
} from '../icons/Icons';

export interface ProjectDetailsModalProps {
  project: Project | null;
  onClose: () => void;
  onDeploy: (project: Project) => void;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  onClose,
  onDeploy,
}) => {
  if (!project) return null;

  const repoName = project.repositoryUrl.replace(/^https:\/\/github\.com\//, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-zinc-950 border border-zinc-850 rounded-md w-full max-w-xl shadow-none overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xs font-semibold text-zinc-100 font-mono">
              {project.name}
            </h3>
            {project.latestDeployment && (
              <StatusBadge status={project.latestDeployment.status} size="sm" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition-colors"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between gap-2">
            <a
              href={project.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-300 hover:text-white inline-flex items-center gap-1.5 hover:underline"
            >
              <GitHubIcon size={13} className="text-zinc-500" />
              <span>{repoName}</span>
              <ExternalLinkIcon size={10} />
            </a>

            <div className="flex items-center gap-2">
              <span className="text-zinc-500 flex items-center gap-1">
                <GitBranchIcon size={11} />
                <span>{project.branch || 'main'}</span>
              </span>
              <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                {project.autoDeploy ? 'auto-deploy on' : 'auto-deploy off'}
              </span>
            </div>
          </div>

          {project.description && (
            <p className="text-zinc-400 font-sans text-xs leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded bg-zinc-900/30 border border-zinc-850 text-[11px]">
            <div>
              <span className="text-zinc-600 block uppercase text-[10px]">
                Build Command
              </span>
              <span className="text-zinc-300 font-mono">
                {project.buildCommand || 'npm run build'}
              </span>
            </div>

            <div>
              <span className="text-zinc-600 block uppercase text-[10px]">
                Start Command
              </span>
              <span className="text-zinc-300 font-mono">
                {project.startCommand || 'npm start'}
              </span>
            </div>

            <div>
              <span className="text-zinc-600 block uppercase text-[10px]">
                Root Directory
              </span>
              <span className="text-zinc-300 font-mono">
                {project.rootDirectory || './'}
              </span>
            </div>

            <div>
              <span className="text-zinc-600 block uppercase text-[10px]">
                Runtime Status
              </span>
              <span className="text-zinc-300 font-mono">
                {project.latestDeployment?.status || 'No deployments'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-zinc-850 bg-zinc-900/20 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onDeploy(project);
              onClose();
            }}
            leftIcon={<PlayIcon size={11} />}
          >
            Deploy
          </Button>
        </div>
      </div>
    </div>
  );
};
