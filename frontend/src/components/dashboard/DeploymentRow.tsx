import React from 'react';
import type { Deployment } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { ExternalLinkIcon, TerminalIcon, GitBranchIcon, RollbackIcon } from '../icons/Icons';

export interface DeploymentRowProps {
  deployment: Deployment;
  showProjectName?: boolean;
  onViewLogs?: (deployment: Deployment) => void;
  onViewDetails?: (deployment: Deployment) => void;
  onRollback?: (deployment: Deployment) => void;
}

export const DeploymentRow: React.FC<DeploymentRowProps> = ({
  deployment,
  showProjectName = true,
  onViewLogs,
  onViewDetails,
  onRollback,
}) => {
  const shortSha = deployment.commitHash
    ? deployment.commitHash.substring(0, 7)
    : null;

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-750 rounded-md transition-colors text-xs font-mono group">
      {/* Left: ID & Status & Project & Branch & SHA */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onViewDetails?.(deployment)}
          className="font-semibold text-zinc-100 hover:text-white truncate cursor-pointer tracking-tight"
          title="View Deployment Details"
        >
          #{deployment.id}
        </button>

        <StatusBadge status={deployment.status} size="sm" />

        {showProjectName && deployment.projectName && (
          <span className="text-zinc-300 font-sans font-medium truncate hidden sm:inline">
            {deployment.projectName}
          </span>
        )}

        {deployment.branch && (
          <span className="text-zinc-500 text-[11px] items-center gap-1 hidden md:inline-flex">
            <GitBranchIcon size={11} className="text-zinc-600" />
            <span>{deployment.branch}</span>
          </span>
        )}

        {shortSha && (
          <span className="text-zinc-500 text-[11px] truncate hidden lg:inline">
            {shortSha}
          </span>
        )}
      </div>

      {/* Right: Timestamp & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-zinc-500 text-[11px] hidden sm:inline">
          {new Date(deployment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {deployment.deploymentUrl && (deployment.status === 'RUNNING' || deployment.status === 'SUCCESS') && (
          <a
            href={deployment.deploymentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-900 transition-colors inline-flex items-center"
            title="Open Live URL"
          >
            <ExternalLinkIcon size={12} />
          </a>
        )}

        {onRollback && (deployment.status === 'SUCCESS' || deployment.status === 'RUNNING' || deployment.status === 'FAILED') && (
          <button
            onClick={() => onRollback(deployment)}
            className="text-zinc-400 hover:text-amber-300 p-1 rounded hover:bg-zinc-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="Rollback to this deployment version"
          >
            <RollbackIcon size={12} />
          </button>
        )}

        {onViewLogs && (
          <button
            onClick={() => onViewLogs(deployment)}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="View Logs"
          >
            <TerminalIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
