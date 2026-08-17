import React, { useState, useEffect, useCallback } from 'react';
import type { Deployment, DeploymentLog, Project } from '../types';
import { deploymentsApi } from '../api/deployments.api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { DeploymentLifecycle } from '../components/deployment/DeploymentLifecycle';
import { TerminalLogViewer } from '../components/deployment/TerminalLogViewer';
import {
  GitBranchIcon,
  GitCommitIcon,
  ExternalLinkIcon,
  PlayIcon,
  StopIcon,
} from '../components/icons/Icons';

interface DeploymentDetailsViewProps {
  deployment: Deployment;
  project?: Project;
  onBack: () => void;
  onRedeploy?: (projectId: number) => Promise<void>;
  onStopDeployment?: (deploymentId: number) => Promise<void>;
}

export const DeploymentDetailsView: React.FC<DeploymentDetailsViewProps> = ({
  deployment: initialDeployment,
  project,
  onBack,
  onRedeploy,
  onStopDeployment,
}) => {
  const [deployment, setDeployment] = useState<Deployment>(initialDeployment);
  const [logs, setLogs] = useState<DeploymentLog[]>(initialDeployment.logs || []);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRedeploying, setIsRedeploying] = useState(false);

  const projectName = deployment.projectName || project?.name;

  // Poll status & logs if deployment is active
  const isActive =
    deployment.status === 'PENDING' ||
    deployment.status === 'BUILDING' ||
    deployment.status === 'RUNNING';

  const fetchLogsAndStatus = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const [logsRes, statusRes] = await Promise.allSettled([
        deploymentsApi.getDeploymentLogs(deployment.id),
        deploymentsApi.getDeploymentStatus(deployment.id),
      ]);

      if (logsRes.status === 'fulfilled' && logsRes.value?.logs) {
        setLogs(logsRes.value.logs);
      }

      if (statusRes.status === 'fulfilled' && statusRes.value?.status) {
        setDeployment((prev) => ({
          ...prev,
          status: statusRes.value.status,
          runtimePort: statusRes.value.runtimePort ?? prev.runtimePort,
          deploymentUrl: statusRes.value.deploymentUrl ?? prev.deploymentUrl,
        }));
      }
    } catch (err) {
      console.warn('Failed to refresh deployment telemetry:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [deployment.id]);

  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      if (!ignore) {
        await fetchLogsAndStatus();
      }
    }
    initialFetch();

    if (!isActive) return () => { ignore = true; };

    const interval = setInterval(() => {
      fetchLogsAndStatus();
    }, 3000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchLogsAndStatus, isActive]);

  const handleStop = async () => {
    if (!onStopDeployment) return;
    try {
      setIsStopping(true);
      await onStopDeployment(deployment.id);
      await fetchLogsAndStatus();
    } finally {
      setIsStopping(false);
    }
  };

  const handleRedeploy = async () => {
    if (!onRedeploy) return;
    try {
      setIsRedeploying(true);
      await onRedeploy(deployment.projectId);
    } finally {
      setIsRedeploying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Summary Bar */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBack} className="h-7 text-xs">
              Back
            </Button>
            <h2 className="text-base font-bold text-zinc-100 font-mono">
              Deployment #{deployment.id}
            </h2>
            <StatusBadge status={deployment.status} size="sm" />
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono flex-wrap">
            {projectName && (
              <span className="text-zinc-200 font-medium font-sans">
                {projectName}
              </span>
            )}
            {deployment.branch && (
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <GitBranchIcon size={11} className="text-zinc-500" />
                <span>{deployment.branch}</span>
              </span>
            )}
            {deployment.commitHash && (
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <GitCommitIcon size={11} className="text-zinc-500" />
                <span>{deployment.commitHash.substring(0, 7)}</span>
              </span>
            )}
            {deployment.deploymentUrl && deployment.status === 'RUNNING' && (
              <a
                href={deployment.deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white inline-flex items-center gap-1 hover:underline"
              >
                <span>{deployment.deploymentUrl}</span>
                <ExternalLinkIcon size={11} />
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {isActive && onStopDeployment && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              isLoading={isStopping}
              leftIcon={<StopIcon size={11} />}
            >
              Stop
            </Button>
          )}

          {onRedeploy && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRedeploy}
              isLoading={isRedeploying}
              leftIcon={<PlayIcon size={11} />}
            >
              Redeploy
            </Button>
          )}
        </div>
      </div>

      {/* 2. Lifecycle Stepper */}
      <DeploymentLifecycle
        status={deployment.status}
        duration={deployment.duration}
      />

      {/* 3. Terminal Log Viewer (Primary visual area) */}
      <TerminalLogViewer
        logs={logs}
        isLoading={isLoadingLogs}
        onRefresh={fetchLogsAndStatus}
        deploymentStatus={deployment.status}
      />
    </div>
  );
};
