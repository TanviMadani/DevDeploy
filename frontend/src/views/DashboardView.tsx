import React from 'react';
import type { Project, Deployment, MetricCardData, ActivityEvent } from '../types';
import { OverviewMetrics } from '../components/dashboard/OverviewMetrics';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { DeploymentRow } from '../components/dashboard/DeploymentRow';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PlusIcon } from '../components/icons/Icons';

export interface DashboardViewProps {
  metrics: MetricCardData[];
  projects: Project[];
  recentDeployments: Deployment[];
  activities: ActivityEvent[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDeployProject: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onViewDeploymentLogs: (deployment: Deployment) => void;
  onNavigateToProjects: () => void;
  onNavigateToDeployments: () => void;
  onNewProjectClick: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  projects,
  recentDeployments,
  activities,
  isLoading = false,
  error = null,
  onRetry,
  onDeployProject,
  onSelectProject,
  onViewDeploymentLogs,
  onNavigateToProjects,
  onNavigateToDeployments,
  onNewProjectClick,
}) => {
  if (error) {
    return (
      <ErrorState
        title="Failed to Load Dashboard Data"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Key Metrics Overview */}
      <section>
        <OverviewMetrics metrics={metrics} />
      </section>

      {/* 2. Projects Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
            Projects
          </h2>
          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToProjects}
                className="text-xs text-zinc-400 hover:text-white"
              >
                View all ({projects.length})
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onNewProjectClick}
              leftIcon={<PlusIcon size={12} />}
              className="text-xs hidden sm:inline-flex"
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-md border border-zinc-850 bg-zinc-900/30 animate-pulse space-y-3"
              >
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
                <div className="h-3 bg-zinc-850 rounded w-full" />
                <div className="pt-3 border-t border-zinc-850 flex justify-between">
                  <div className="h-3 bg-zinc-850 rounded w-16" />
                  <div className="h-3 bg-zinc-850 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.slice(0, 6).map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeploy={onDeployProject}
                onSelect={onSelectProject}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet."
            actionLabel="New Project"
            onAction={onNewProjectClick}
          />
        )}
      </section>

      {/* 3. Bottom Grid: Recent Deployments & Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deployments */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Recent Deployments
            </h2>
            {recentDeployments.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToDeployments}
                className="text-xs text-zinc-400 hover:text-white"
              >
                View all ({recentDeployments.length})
              </Button>
            )}
          </div>

          {isLoading ? (
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
          ) : recentDeployments.length > 0 ? (
            <div className="space-y-1.5">
              {recentDeployments.slice(0, 6).map((deployment) => (
                <DeploymentRow
                  key={deployment.id}
                  deployment={deployment}
                  showProjectName={true}
                  onViewLogs={onViewDeploymentLogs}
                  onViewDetails={() => {
                    const matchedProj = projects.find((p) => p.id === deployment.projectId);
                    if (matchedProj) onSelectProject(matchedProj);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No deployments recorded."
            />
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
            Activity
          </h2>
          <Card className="p-0 overflow-hidden">
            <ActivityFeed activities={activities} />
          </Card>
        </div>
      </section>
    </div>
  );
};
