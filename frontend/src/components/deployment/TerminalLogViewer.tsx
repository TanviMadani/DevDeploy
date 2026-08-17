import React, { useState, useEffect, useRef } from 'react';
import type { DeploymentLog } from '../../types';
import { Button } from '../ui/Button';
import { TerminalIcon, SearchIcon } from '../icons/Icons';

interface TerminalLogViewerProps {
  logs: DeploymentLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
  deploymentStatus?: string;
}

export const TerminalLogViewer: React.FC<TerminalLogViewerProps> = ({
  logs,
  isLoading = false,
  onRefresh,
}) => {
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new logs arrive if enabled
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) =>
    log.message.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleCopyLogs = () => {
    const rawText = logs
      .map((l) => `[${new Date(l.createdAt).toLocaleTimeString()}] ${l.message}`)
      .join('\n');
    navigator.clipboard?.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogStyle = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) {
      return 'text-rose-400 font-semibold';
    }
    if (lower.includes('warn') || lower.includes('warning')) {
      return 'text-amber-400';
    }
    if (lower.includes('success') || lower.includes('passed') || lower.includes('ready') || lower.includes('healthy')) {
      return 'text-emerald-400';
    }
    if (lower.startsWith('>') || lower.startsWith('[') || lower.includes('executing')) {
      return 'text-zinc-200';
    }
    return 'text-zinc-400';
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded-md overflow-hidden flex flex-col font-mono text-xs shadow-none">
      {/* Terminal Control Bar */}
      <div className="bg-zinc-900/60 px-3.5 py-2 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-zinc-300">
          <TerminalIcon size={14} className="text-zinc-400" />
          <span className="font-semibold text-xs text-zinc-200">Execution Logs</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
            {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter logs..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-6 pr-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-32 sm:w-44 h-6"
            />
            <SearchIcon
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>

          {/* Autoscroll Toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer h-6 font-mono ${
              autoScroll
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-zinc-950 text-zinc-500 border border-zinc-850 hover:text-zinc-300'
            }`}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Copy Logs */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLogs}
            className="text-[11px] px-2 h-6 font-mono"
            disabled={logs.length === 0}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>

          {/* Refresh */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoading}
              className="text-[11px] px-2 h-6 font-mono"
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="p-3.5 bg-black overflow-x-auto max-h-[460px] min-h-[220px] select-text">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs">
            {filterText ? (
              <span>No log messages matching filter "{filterText}"</span>
            ) : isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                <span>Streaming logs from build worker...</span>
              </div>
            ) : (
              <span>No logs generated for this deployment yet.</span>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => {
              const time = new Date(log.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id || index}
                  className="flex items-start gap-3 leading-relaxed hover:bg-zinc-900/40 px-1 py-0.5 rounded transition-colors group"
                >
                  <span className="text-zinc-600 select-none shrink-0 w-8 text-right text-[10px]">
                    {index + 1}
                  </span>
                  <span className="text-zinc-600 text-[10px] select-none shrink-0">
                    {time}
                  </span>
                  <span className={`break-all ${getLogStyle(log.message)}`}>
                    {log.message}
                  </span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
