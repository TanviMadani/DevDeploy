import React, { useState, useEffect, useRef } from 'react';
import type { Deployment, DeploymentLog } from '../../types';
import { deploymentsApi } from '../../api/deployments.api';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../../api/client';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  TerminalIcon,
  XIcon,
  GitBranchIcon,
  GitCommitIcon,
  ExternalLinkIcon,
} from '../icons/Icons';

export interface LogViewerModalProps {
  deployment: Deployment | null;
  onClose: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  deployment: initialDeployment,
  onClose,
}) => {
  const [deployment, setDeployment] = useState<Deployment | null>(initialDeployment);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDeployment(initialDeployment);
  }, [initialDeployment]);

  useEffect(() => {
    if (!deployment) return;

    let isSubscribed = true;

    // 1. Initial REST fetch for immediate logs
    async function loadLogs() {
      try {
        if (!deployment) return;
        setIsLoading(true);
        const res = await deploymentsApi.getDeploymentLogs(deployment.id);
        if (isSubscribed && res.logs) {
          setLogs(res.logs.map((l: DeploymentLog) => l.message));
        }
      } catch (err) {
        console.warn('Could not load logs via REST:', err);
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    }

    loadLogs();

    // 2. Connect to SSE stream if deployment is active
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const streamUrl = `${API_BASE_URL}/deployments/${deployment.id}/logs/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log' && data.message) {
            setLogs((prev) => {
              if (prev.includes(data.message)) return prev;
              return [...prev, data.message];
            });
          }
          if (data.type === 'status' && data.status) {
            setDeployment((prev) => (prev ? { ...prev, status: data.status } : prev));
          }
          if (data.type === 'done') {
            eventSource?.close();
          }
        } catch {
          // Non-JSON message / heartbeat
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch (err) {
      console.warn('SSE connection failed, falling back to static logs:', err);
    }

    return () => {
      isSubscribed = false;
      eventSource?.close();
    };
  }, [deployment?.id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!deployment) return null;

  const handleCopyLogs = () => {
    navigator.clipboard?.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-zinc-950 border border-zinc-850 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between gap-4 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-cyan-400">
              <TerminalIcon size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-100 font-mono">
                  {deployment.projectName || `Deployment #${deployment.id}`}
                </h3>
                <StatusBadge status={deployment.status} size="sm" />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono mt-0.5">
                {deployment.commitHash && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <GitCommitIcon size={11} className="text-zinc-500" />
                    {deployment.commitHash.substring(0, 7)}
                  </span>
                )}
                {deployment.branch && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <GitBranchIcon size={11} className="text-zinc-500" />
                    {deployment.branch}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deployment.deploymentUrl && (deployment.status === 'RUNNING' || deployment.status === 'SUCCESS') && (
              <a
                href={deployment.deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/40 rounded transition-colors"
              >
                <span>Live App</span>
                <ExternalLinkIcon size={10} />
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              className="text-xs h-7 font-mono"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Terminal Log Window */}
        <div className="flex-1 p-4 bg-black/95 overflow-y-auto font-mono text-xs text-zinc-300 space-y-1 select-text scrollbar-thin">
          {isLoading && logs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">Connecting to log stream...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">No logs recorded for this deployment.</div>
          ) : (
            logs.map((log, index) => {
              const isError = log.includes('failed') || log.includes('error') || log.includes('[ERROR]') || log.includes('ERR!');
              const isSuccess = log.includes('succeeded') || log.includes('successfully') || log.includes('built in') || log.includes('✓');
              const isInfo = log.includes('Starting') || log.includes('Cloning') || log.includes('Installing') || log.includes('Allocated');

              return (
                <div
                  key={index}
                  className={`leading-relaxed whitespace-pre-wrap ${
                    isError
                      ? 'text-rose-400 font-semibold'
                      : isSuccess
                      ? 'text-emerald-400'
                      : isInfo
                      ? 'text-cyan-300'
                      : 'text-zinc-300'
                  }`}
                >
                  {log}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-850 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-zinc-400">Live SSE Stream Connected</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} className="h-7 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
