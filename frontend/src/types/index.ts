export type DeploymentStatus =
  | 'PENDING'
  | 'BUILDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'STOPPED'
  | 'CANCELLED';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl?: string;
  role?: string;
}

export interface EnvironmentVariable {
  id: number;
  key: string;
  value: string;
  projectId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  repositoryUrl: string;
  autoDeploy: boolean;
  buildCommand?: string | null;
  startCommand?: string | null;
  rootDirectory?: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  latestDeployment?: Deployment | null;
  deployments?: Deployment[];
  envVars?: EnvironmentVariable[];
  activeDeploymentsCount?: number;
  framework?: string;
  branch?: string;
}

export interface Deployment {
  id: number;
  projectId: number;
  projectName?: string;
  status: DeploymentStatus;
  commitHash?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
  runtimePort?: number | null;
  deploymentUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  duration?: string;
  triggeredBy?: string;
  logs?: DeploymentLog[];
  project?: Project;
}

export interface DeploymentLog {
  id: number;
  deploymentId: number;
  message: string;
  createdAt: string;
  level?: 'info' | 'warn' | 'error' | 'success' | 'stdout' | 'stderr';
}

export type NavigationTab =
  | 'dashboard'
  | 'projects'
  | 'new-project'
  | 'project-details'
  | 'deployment-details'
  | 'deployments'
  | 'settings'
  | 'login'
  | 'register';

export interface MetricCardData {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  icon?: string;
}

export interface ActivityEvent {
  id: string;
  type: 'deploy_success' | 'deploy_failed' | 'deploy_started' | 'project_created';
  projectName: string;
  projectId: number;
  deploymentId?: number;
  timestamp: string;
  user: string;
  details?: string;
}
