import React, { useState, useMemo } from 'react';
import type { Deployment, DeploymentStatus } from '../types';
import { DeploymentRow } from '../components/dashboard/DeploymentRow';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { SearchIcon, RefreshIcon } from '../components/icons/Icons';

export interface DeploymentsViewProps {
  deployments: Deployment[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewLogs: (deployment: Deployment) => void;
  onViewDetails?: (deployment: Deployment) => void;
  onRollback?: (deployment: Deployment) => void;
}

export const DeploymentsView: React.FC<DeploymentsViewProps> = ({
  deployments,
  isLoading = false,
  error = null,
  onRetry,
  onViewLogs,
  onViewDetails,
  onRollback,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<DeploymentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const statuses: (DeploymentStatus | 'ALL')[] = [
    'ALL',
    'BUILDING',
    'RUNNING',
    'SUCCESS',
    'FAILED',
    'PENDING',
    'STOPPED',
  ];

  const filteredDeployments = useMemo(() => {
    return deployments.filter((dep) => {
      const matchesStatus =
        selectedStatus === 'ALL' || dep.status === selectedStatus;

      const matchesSearch =
        (dep.projectName &&
          dep.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dep.commitMessage &&
          dep.commitMessage.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dep.commitHash &&
          dep.commitHash.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dep.branch && dep.branch.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesStatus && matchesSearch;
    });
  }, [deployments, selectedStatus, searchQuery]);

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Deployments"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Deployments
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {deployments.length} total runs
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              isLoading={isLoading}
              leftIcon={<RefreshIcon size={12} />}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <SearchIcon
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project, branch, or commit SHA..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono h-8"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {statuses.map((status) => {
            const isSelected = selectedStatus === status;
            const count =
              status === 'ALL'
                ? deployments.length
                : deployments.filter((d) => d.status === status).length;

            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer h-8 ${
                  isSelected
                    ? 'bg-zinc-850 text-zinc-100 border border-zinc-700'
                    : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-850'
                }`}
              >
                {status !== 'ALL' && (
                  <StatusBadge status={status as DeploymentStatus} size="sm" showPulse={false} />
                )}
                <span>{status === 'ALL' ? 'All' : ''}</span>
                <span className="text-[10px] text-zinc-500">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Deployment Rows */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-md border border-zinc-850 bg-zinc-900/30 animate-pulse flex items-center justify-between"
            >
              <div className="h-3 bg-zinc-800 rounded w-20" />
              <div className="h-3 bg-zinc-850 rounded w-16" />
            </div>
          ))}
        </div>
      ) : filteredDeployments.length > 0 ? (
        <div className="space-y-1.5">
          {filteredDeployments.map((dep) => (
            <DeploymentRow
              key={dep.id}
              deployment={dep}
              showProjectName={true}
              onViewLogs={onViewLogs}
              onViewDetails={onViewDetails}
              onRollback={onRollback}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={searchQuery ? 'No matching deployments found.' : 'No deployments recorded.'}
        />
      )}
    </div>
  );
};
