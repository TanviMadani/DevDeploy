import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  NavigationTab,
  Project,
  Deployment,
  MetricCardData,
  ActivityEvent,
} from './types';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { projectsApi } from './api/projects.api';
import { deploymentsApi } from './api/deployments.api';
import { AuthView } from './views/AuthView';
import { Layout } from './components/layout/Layout';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { NewProjectView } from './views/NewProjectView';
import { ProjectDetailsView } from './views/ProjectDetailsView';
import { DeploymentDetailsView } from './views/DeploymentDetailsView';
import { DeploymentsView } from './views/DeploymentsView';
import { SettingsView } from './views/SettingsView';
import { LogViewerModal } from './components/modals/LogViewerModal';
import { LogoIcon } from './components/icons/Icons';
import type { CreateProjectRequest } from './api/types';

function MainApp() {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Selected Resources for Detailed Views
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [activeLogDeployment, setActiveLogDeployment] = useState<Deployment | null>(null);

  // Real Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);

  // Selected Project Data (for ProjectDetailsView)
  const [projectDeployments, setProjectDeployments] = useState<Deployment[]>([]);
  const [latestProjectDeployment, setLatestProjectDeployment] = useState<Deployment | null>(null);
  const [isLoadingProjectDeployments, setIsLoadingProjectDeployments] = useState<boolean>(false);

  // Fetch all user projects and recent deployments
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    setDataError(null);

    try {
      const projectsRes = await projectsApi.getProjects();
      const loadedProjects = projectsRes.projects || [];
      setProjects(loadedProjects);

      // Fetch deployments across projects for dashboard overview
      const allDeps: Deployment[] = [];
      await Promise.allSettled(
        loadedProjects.map(async (p) => {
          try {
            const depRes = await deploymentsApi.getProjectDeployments(p.id);
            if (depRes.deployments) {
              const enriched = depRes.deployments.map((d) => ({
                ...d,
                projectName: p.name,
                project: p,
              }));
              allDeps.push(...enriched);
            }
          } catch {
            // Ignore individual project deployment failures gracefully
          }
        })
      );

      // Sort deployments newest first
      allDeps.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setDeployments(allDeps);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch projects and telemetry from server.';
      setDataError(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated]);

  // Initial load when authenticated
  useEffect(() => {
    let ignore = false;
    async function load() {
      if (isAuthenticated && !ignore) {
        await fetchData();
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, fetchData]);

  // Fetch project-specific deployments when selectedProjectId changes
  const fetchSelectedProjectData = useCallback(async (projId: number) => {
    setIsLoadingProjectDeployments(true);
    try {
      const [depsRes, latestRes] = await Promise.allSettled([
        deploymentsApi.getProjectDeployments(projId),
        deploymentsApi.getLatestDeployment(projId),
      ]);

      if (depsRes.status === 'fulfilled' && depsRes.value?.deployments) {
        setProjectDeployments(depsRes.value.deployments);
      }
      if (latestRes.status === 'fulfilled') {
        setLatestProjectDeployment(latestRes.value?.deployment || null);
      }
    } catch (err) {
      console.warn('Failed to load project deployments:', err);
    } finally {
      setIsLoadingProjectDeployments(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadProj() {
      if (selectedProjectId && activeTab === 'project-details' && !ignore) {
        await fetchSelectedProjectData(selectedProjectId);
      }
    }
    loadProj();
    return () => {
      ignore = true;
    };
  }, [selectedProjectId, activeTab, fetchSelectedProjectData]);

  // Compute live metrics dynamically from real projects & deployments
  const metrics: MetricCardData[] = useMemo(() => {
    const totalProjects = projects.length;
    const activeDeployments = deployments.filter(
      (d) => d.status === 'BUILDING' || d.status === 'RUNNING' || d.status === 'PENDING'
    ).length;

    const completed = deployments.filter(
      (d) => d.status === 'SUCCESS' || d.status === 'FAILED' || d.status === 'RUNNING'
    );
    const successCount = deployments.filter(
      (d) => d.status === 'SUCCESS' || d.status === 'RUNNING'
    ).length;
    const successRate =
      completed.length > 0
        ? `${((successCount / completed.length) * 100).toFixed(1)}%`
        : '100%';

    return [
      {
        title: 'Total Projects',
        value: totalProjects,
        description: 'Active repositories connected',
        icon: 'folder',
      },
      {
        title: 'Active Deployments',
        value: activeDeployments,
        description: 'Containers currently active',
        icon: 'activity',
      },
      {
        title: 'Pipeline Success Rate',
        value: successRate,
        description: `Across ${deployments.length} recorded builds`,
        icon: 'check-circle',
      },
      {
        title: 'Total Deployments',
        value: deployments.length,
        description: 'All-time deployment runs',
        icon: 'clock',
      },
    ];
  }, [projects, deployments]);

  // Compute activity stream from real deployments
  const activities: ActivityEvent[] = useMemo(() => {
    return deployments.slice(0, 8).map((d) => {
      const type: ActivityEvent['type'] =
        d.status === 'SUCCESS' || d.status === 'RUNNING'
          ? 'deploy_success'
          : d.status === 'FAILED'
          ? 'deploy_failed'
          : 'deploy_started';

      return {
        id: `act-${d.id}`,
        type,
        projectName: d.projectName || `Project #${d.projectId}`,
        projectId: d.projectId,
        deploymentId: d.id,
        timestamp: new Date(d.createdAt).toLocaleTimeString(),
        user: d.triggeredBy || user?.name || 'System Webhook',
        details: d.commitMessage || `Deployment #${d.id} status: ${d.status}`,
      };
    });
  }, [deployments, user]);

  // Action: Create Project
  const handleCreateProject = async (data: CreateProjectRequest) => {
    setIsCreatingProject(true);
    try {
      const res = await projectsApi.createProject(data);
      if (res.project) {
        await fetchData();
        setSelectedProjectId(res.project.id);
        setActiveTab('project-details');
      }
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Action: Trigger Deployment
  const handleDeployProject = async (project: Project) => {
    try {
      const res = await projectsApi.triggerDeployment(project.id);
      if (res.deployment) {
        // Enriched deployment
        const enriched: Deployment = {
          ...res.deployment,
          projectName: project.name,
          project,
        };
        setDeployments((prev) => [enriched, ...prev]);
        setProjectDeployments((prev) => [enriched, ...prev]);
        setLatestProjectDeployment(enriched);
        setActiveLogDeployment(enriched);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to trigger deployment: ${msg}`);
    }
  };

  // Action: Stop Deployment
  const handleStopDeployment = async (deploymentId: number) => {
    try {
      const res = await deploymentsApi.stopDeployment(deploymentId);
      if (res.deployment) {
        setDeployments((prev) =>
          prev.map((d) => (d.id === deploymentId ? { ...d, status: res.deployment.status } : d))
        );
        setProjectDeployments((prev) =>
          prev.map((d) => (d.id === deploymentId ? { ...d, status: res.deployment.status } : d))
        );
        if (latestProjectDeployment?.id === deploymentId) {
          setLatestProjectDeployment(res.deployment);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to stop deployment: ${msg}`);
    }
  };

  // Action: Rollback Deployment
  const handleRollbackDeployment = async (deployment: Deployment) => {
    try {
      const res = await deploymentsApi.rollbackDeployment(deployment.id);
      if (res.deployment) {
        const enriched: Deployment = {
          ...res.deployment,
          projectName: selectedProject?.name || deployment.projectName,
          project: selectedProject || deployment.project,
        };
        setDeployments((prev) => [enriched, ...prev]);
        setProjectDeployments((prev) => [enriched, ...prev]);
        setLatestProjectDeployment(enriched);
        setActiveLogDeployment(enriched);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to rollback deployment: ${msg}`);
    }
  };

  // Selected Project Object
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // 1. Initial Auth Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="p-2.5 rounded-md bg-zinc-900 border border-zinc-800 mb-3 text-zinc-100">
          <LogoIcon size={24} />
        </div>
        <h2 className="text-xs font-semibold text-zinc-200 tracking-tight font-mono">DevDeploy</h2>
        <p className="text-[11px] text-zinc-500 font-mono mt-1">Connecting...</p>
      </div>
    );
  }

  // 2. Unauthenticated View (Login / Register)
  if (!isAuthenticated) {
    return <AuthView />;
  }

  // 3. Authenticated App Layout & Views
  const activeDeploymentsCount = deployments.filter(
    (d) => d.status === 'BUILDING' || d.status === 'RUNNING' || d.status === 'PENDING'
  ).length;

  return (
    <Layout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      currentUser={user}
      onNewProjectClick={() => setActiveTab('new-project')}
      onLogout={logout}
      projectCount={projects.length}
      activeDeploymentsCount={activeDeploymentsCount}
    >
      {/* 1. Dashboard View */}
      {activeTab === 'dashboard' && (
        <DashboardView
          metrics={metrics}
          projects={projects}
          recentDeployments={deployments}
          activities={activities}
          isLoading={isLoadingData}
          error={dataError}
          onRetry={fetchData}
          onDeployProject={handleDeployProject}
          onSelectProject={(p) => {
            setSelectedProjectId(p.id);
            setActiveTab('project-details');
          }}
          onViewDeploymentLogs={(d) => setActiveLogDeployment(d)}
          onNavigateToProjects={() => setActiveTab('projects')}
          onNavigateToDeployments={() => setActiveTab('deployments')}
          onNewProjectClick={() => setActiveTab('new-project')}
        />
      )}

      {/* 2. Projects Catalog View */}
      {activeTab === 'projects' && (
        <ProjectsView
          projects={projects}
          isLoading={isLoadingData}
          error={dataError}
          onRetry={fetchData}
          onDeployProject={handleDeployProject}
          onSelectProject={(p) => {
            setSelectedProjectId(p.id);
            setActiveTab('project-details');
          }}
          onNewProjectClick={() => setActiveTab('new-project')}
        />
      )}

      {/* 3. New Project Page */}
      {activeTab === 'new-project' && (
        <NewProjectView
          onSubmit={handleCreateProject}
          onCancel={() => setActiveTab('projects')}
          isLoading={isCreatingProject}
        />
      )}

      {/* 4. Project Details Page */}
      {activeTab === 'project-details' && selectedProject && (
        <ProjectDetailsView
          project={selectedProject}
          deployments={projectDeployments}
          latestDeployment={latestProjectDeployment}
          isLoadingDeployments={isLoadingProjectDeployments}
          onDeploy={handleDeployProject}
          onStopDeployment={handleStopDeployment}
          onRollback={handleRollbackDeployment}
          onViewDeploymentDetails={(d) => {
            setSelectedDeployment(d);
            setActiveTab('deployment-details');
          }}
          onViewLogs={(d) => setActiveLogDeployment(d)}
          onBack={() => setActiveTab('projects')}
          onRefresh={() => selectedProjectId && fetchSelectedProjectData(selectedProjectId)}
        />
      )}

      {/* 5. Deployment Details & Monitor Page */}
      {activeTab === 'deployment-details' && selectedDeployment && (
        <DeploymentDetailsView
          deployment={selectedDeployment}
          project={selectedDeployment.project || selectedProject || undefined}
          onBack={() => setActiveTab('project-details')}
          onRedeploy={async (projId) => {
            const p = projects.find((x) => x.id === projId) || selectedProject;
            if (p) await handleDeployProject(p);
          }}
          onStopDeployment={handleStopDeployment}
        />
      )}

      {/* 6. Deployments History View */}
      {activeTab === 'deployments' && (
        <DeploymentsView
          deployments={deployments}
          isLoading={isLoadingData}
          error={dataError}
          onRetry={fetchData}
          onViewLogs={(d) => setActiveLogDeployment(d)}
          onRollback={handleRollbackDeployment}
          onViewDetails={(d) => {
            setSelectedDeployment(d);
            setActiveTab('deployment-details');
          }}
        />
      )}

      {/* 7. Settings View */}
      {activeTab === 'settings' && <SettingsView />}

      {/* Log Console Modal (for Quick View from anywhere) */}
      <LogViewerModal
        deployment={activeLogDeployment}
        onClose={() => setActiveLogDeployment(null)}
      />
    </Layout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;