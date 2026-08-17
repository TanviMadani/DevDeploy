import React, { useState } from 'react';
import { Button } from '../components/ui/Button';

export const SettingsView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const webhookUrl = 'http://localhost:5000/api/webhooks/github';

  const handleCopy = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
          Settings
        </h2>
        <p className="text-xs text-zinc-500 font-mono">
          Platform parameters and GitHub webhook integration
        </p>
      </div>

      {/* GitHub Webhook Integration */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 space-y-3 font-mono text-xs">
        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
          GitHub Webhook Setup
        </span>

        <p className="text-zinc-400 font-sans text-xs">
          Configure this webhook URL in your GitHub repository (<span className="text-zinc-200">Settings → Webhooks → Add webhook</span>) with Content type set to <span className="text-zinc-200">application/json</span>.
        </p>

        <div>
          <label className="block text-zinc-400 text-[11px] mb-1">
            Payload URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-1.5 bg-black border border-zinc-800 rounded-md text-zinc-200 text-xs focus:outline-none h-8 select-all"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Cluster & Environment */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-md p-4 space-y-3 font-mono text-xs">
        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
          Runtime Node
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-zinc-500 text-[11px] block">Cluster</span>
            <span className="text-zinc-300">dev-cluster-primary</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[11px] block">Node Host</span>
            <span className="text-zinc-300">local-node (127.0.0.1)</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[11px] block">Port Range</span>
            <span className="text-zinc-300">3000 - 3999</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[11px] block">Build Timeout</span>
            <span className="text-zinc-300">600s (10 min)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
