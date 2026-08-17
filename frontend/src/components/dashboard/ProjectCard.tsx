import React from 'react';
import type { Project } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { ExternalLinkIcon, PlayIcon, GitBranchIcon } from '../icons/Icons';

export interface ProjectCardProps {
  project: Project;
  onDeploy?: (project: Project) => void;
  onSelect?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDeploy,
  onSelect,
}) => {
  const latestDeployment = project.latestDeployment;
  const repoName = project.repositoryUrl.replace(/^https:\/\/github\.com\//, '');

  return (
    <div className="bg-zinc-950 border border-zinc-850 hover:border-zinc-750 rounded-md p-4 transition-colors flex flex-col justify-between group">
      <div>
        {/* Top: Name & Status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onSelect?.(project)}
              className="text-sm font-semibold text-zinc-100 hover:text-white text-left truncate cursor-pointer block tracking-tight"
            >
              {project.name}
            </button>
            <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
              {repoName}
            </p>
          </div>

          {latestDeployment && (
            <StatusBadge status={latestDeployment.status} size="sm" />
          )}
        </div>

        {/* Branch & Auto-deploy */}
        <div className="text-xs text-zinc-500 font-mono space-y-1 my-3 pt-2.5 border-t border-zinc-900">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-zinc-400">
              <GitBranchIcon size={11} className="text-zinc-500" />
              <span>{project.branch || 'main'}</span>
            </span>

            {project.autoDeploy && (
              <span className="text-[10px] text-emerald-400 font-mono">
                auto-deploy
              </span>
            )}
          </div>

          {latestDeployment?.deploymentUrl && latestDeployment.status === 'RUNNING' && (
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-zinc-500">URL:</span>
              <a
                href={latestDeployment.deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white inline-flex items-center gap-1 hover:underline truncate max-w-[170px]"
              >
                <span>{latestDeployment.deploymentUrl.replace('http://', '').replace('https://', '')}</span>
                <ExternalLinkIcon size={10} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-zinc-900">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect?.(project)}
          className="text-xs text-zinc-400 hover:text-white px-2 h-7"
        >
          Details
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDeploy?.(project)}
          leftIcon={<PlayIcon size={11} />}
          className="text-xs h-7"
        >
          Deploy
        </Button>
      </div>
    </div>
  );
};
