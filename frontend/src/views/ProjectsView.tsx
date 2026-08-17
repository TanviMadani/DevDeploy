import React, { useState, useMemo } from 'react';
import type { Project } from '../types';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PlusIcon, SearchIcon, RefreshIcon } from '../components/icons/Icons';

export interface ProjectsViewProps {
  projects: Project[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDeployProject: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onNewProjectClick: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  isLoading = false,
  error = null,
  onRetry,
  onDeployProject,
  onSelectProject,
  onNewProjectClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');

  const frameworks = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.framework) set.add(p.framework);
    });
    return Array.from(set);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.repositoryUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description &&
          project.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFramework =
        frameworkFilter === 'all' || project.framework === frameworkFilter;

      return matchesSearch && matchesFramework;
    });
  }, [projects, searchQuery, frameworkFilter]);

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Projects"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Projects
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
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
          <Button
            variant="primary"
            size="sm"
            onClick={onNewProjectClick}
            leftIcon={<PlusIcon size={12} />}
          >
            New Project
          </Button>
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
            placeholder="Search projects..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono h-8"
          />
        </div>

        {/* Framework Filter Pills */}
        {frameworks.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFrameworkFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer h-8 ${
                frameworkFilter === 'all'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700'
                  : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-850'
              }`}
            >
              All
            </button>
            {frameworks.map((fw) => (
              <button
                key={fw}
                onClick={() => setFrameworkFilter(fw)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer h-8 ${
                  frameworkFilter === fw
                    ? 'bg-zinc-850 text-zinc-100 border border-zinc-700'
                    : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-850'
                }`}
              >
                {fw}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Projects Grid, Loading Skeleton or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
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
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProjects.map((project) => (
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
          title={searchQuery ? 'No matching projects found.' : 'No projects yet.'}
          actionLabel={searchQuery ? undefined : 'New Project'}
          onAction={searchQuery ? undefined : onNewProjectClick}
        />
      )}
    </div>
  );
};
