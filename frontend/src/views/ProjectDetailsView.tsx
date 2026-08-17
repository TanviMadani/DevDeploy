import React, { useState } from 'react';
import type { Project, Deployment } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { DeploymentRow } from '../components/dashboard/DeploymentRow';
import { EmptyState } from '../components/ui/EmptyState';
import {
  GitHubIcon,
  GitBranchIcon,
  PlayIcon,
  StopIcon,
  ExternalLinkIcon,
  TerminalIcon,
  RefreshIcon,
} from '../components/icons/Icons';

import { EnvironmentVariablesSection } from '../components/project/EnvironmentVariablesSection';

interface ProjectDetailsViewProps {
  project: Project;
  deployments: Deployment[];
  latestDeployment: Deployment | null;
  isLoadingDeployments?: boolean;
  onDeploy: (project: Project) => Promise<void>;
  onStopDeployment?: (deploymentId: number) => Promise<void>;
  onRollback?: (deployment: Deployment) => Promise<void>;
  onViewDeploymentDetails: (deployment: Deployment) => void;
  onViewLogs: (deployment: Deployment) => void;
  onBack: () => void;
  onRefresh?: () => void;
}

export const ProjectDetailsView: React.FC<ProjectDetailsViewProps> = ({
  project,
  deployments,
  latestDeployment,
  isLoadingDeployments = false,
  onDeploy,
  onStopDeployment,
  onRollback,
  onViewDeploymentDetails,
  onViewLogs,
  onBack,
  onRefresh,
}) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      await onDeploy(project);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleStop = async (id: number) => {
    if (!onStopDeployment) return;
    try {
      setStoppingId(id);
      await onStopDeployment(id);
    } finally {
      setStoppingId(null);
    }
  };

  const isCurrentActive =
    latestDeployment &&
    (latestDeployment.status === 'BUILDING' ||
      latestDeployment.status === 'PENDING' ||
      latestDeployment.status === 'RUNNING');

  const repoName = project.repositoryUrl.replace(/^https:\/\/github\.com\//, '');
  const cleanLiveUrl = `http://localhost:5000/live/${encodeURIComponent(project.name)}`;

  return (
    <div className="space-y-6">
      {/* 1. Project Header */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
              {project.name}
            </h2>
            {latestDeployment && (
              <StatusBadge status={latestDeployment.status} size="sm" />
            )}
          </div>

          {project.description && (
            <p className="text-xs text-zinc-400 max-w-xl">
              {project.description}
            </p>
          )}

          {/* Meta Details */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono flex-wrap pt-1">
            <a
              href={project.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-200 inline-flex items-center gap-1.5 text-zinc-400 hover:underline"
            >
              <GitHubIcon size={13} className="text-zinc-500" />
              <span>{repoName}</span>
              <ExternalLinkIcon size={11} />
            </a>

            <span className="inline-flex items-center gap-1 text-zinc-400">
              <GitBranchIcon size={11} className="text-zinc-500" />
              <span>{project.branch || 'main'}</span>
            </span>

            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                project.autoDeploy
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}
            >
              Auto-deploy: {project.autoDeploy ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoadingDeployments}
              leftIcon={<RefreshIcon size={12} />}
            >
              Refresh
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleDeploy}
            isLoading={isDeploying}
            leftIcon={<PlayIcon size={12} />}
          >
            Deploy
          </Button>
        </div>
      </div>

      {/* 2. Latest Deployment Live Banner (if exists) */}
      {latestDeployment && (
        <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                Active Deployment
              </span>
              <button
                onClick={() => onViewDeploymentDetails(latestDeployment)}
                className="font-bold text-zinc-200 hover:text-white underline-offset-2 hover:underline cursor-pointer"
              >
                #{latestDeployment.id}
              </button>
              <StatusBadge status={latestDeployment.status} size="sm" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewLogs(latestDeployment)}
                leftIcon={<TerminalIcon size={12} />}
                className="h-7 text-xs"
              >
                Logs
              </Button>

              {isCurrentActive && onStopDeployment && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleStop(latestDeployment.id)}
                  isLoading={stoppingId === latestDeployment.id}
                  leftIcon={<StopIcon size={12} />}
                  className="h-7 text-xs"
                >
                  Stop
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-900 text-zinc-400">
            <div>
              <span className="text-[10px] text-zinc-600 block">Commit</span>
              <span className="text-zinc-300">
                {latestDeployment.commitHash ? latestDeployment.commitHash.substring(0, 7) : 'n/a'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-zinc-600 block">Live Application URL</span>
              {(latestDeployment.status === 'SUCCESS' || latestDeployment.status === 'RUNNING') ? (
                <div className="space-y-1">
                  <a
                    href={cleanLiveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold hover:underline truncate"
                  >
                    <span>{cleanLiveUrl}</span>
                    <ExternalLinkIcon size={10} />
                  </a>
                  {latestDeployment.deploymentUrl && (
                    <div className="text-[10px] text-zinc-500">
                      Direct port: {latestDeployment.deploymentUrl}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-zinc-600">
                  {latestDeployment.status === 'BUILDING' ? 'Building...' : 'Not serving'}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] text-zinc-600 block">Deployed</span>
              <span className="text-zinc-400">
                {new Date(latestDeployment.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Build & Runtime Config Info */}
      {(project.buildCommand || project.startCommand || project.rootDirectory) && (
        <div className="bg-zinc-950 border border-zinc-850 rounded-md p-3.5 font-mono text-xs text-zinc-400">
          <span className="text-[10px] text-zinc-500 block uppercase tracking-wider mb-2">
            Build & Runtime Configuration
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div>
              <span className="text-zinc-600 block">Root Directory</span>
              <span className="text-zinc-300">{project.rootDirectory || './ (repo root)'}</span>
            </div>
            <div>
              <span className="text-zinc-600 block">Build Command</span>
              <span className="text-zinc-300">{project.buildCommand || 'npm run build'}</span>
            </div>
            <div>
              <span className="text-zinc-600 block">Start Command</span>
              <span className="text-zinc-300">{project.startCommand || 'npm start (auto-detect)'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Environment Variables Management */}
      <EnvironmentVariablesSection projectId={project.id} />

      {/* 5. Deployment History Table / Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
            Deployment History
          </h3>
          <span className="text-xs text-zinc-500 font-mono">
            {deployments.length} {deployments.length === 1 ? 'run' : 'runs'}
          </span>
        </div>

        {isLoadingDeployments ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-md border border-zinc-850 bg-zinc-900/30 animate-pulse flex items-center justify-between"
              >
                <div className="h-3 bg-zinc-800 rounded w-20" />
                <div className="h-3 bg-zinc-850 rounded w-16" />
              </div>
            ))}
          </div>
        ) : deployments.length > 0 ? (
          <div className="space-y-1.5">
            {deployments.map((dep) => (
              <DeploymentRow
                key={dep.id}
                deployment={dep}
                showProjectName={false}
                onViewLogs={onViewLogs}
                onViewDetails={onViewDeploymentDetails}
                onRollback={onRollback}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No deployments for this project yet."
            actionLabel="Trigger First Deployment"
            onAction={handleDeploy}
          />
        )}
      </div>
    </div>
  );
};
