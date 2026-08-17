import type { User, Project, Deployment, DeploymentLog, DeploymentStatus, EnvironmentVariable } from '../types';

// Auth Payloads
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface GetMeResponse {
  user: User;
}

// Project Payloads
export interface CreateProjectRequest {
  name: string;
  description?: string;
  repositoryUrl: string;
  autoDeploy?: boolean;
  buildCommand?: string;
  startCommand?: string;
  rootDirectory?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  autoDeploy?: boolean;
  buildCommand?: string;
  startCommand?: string;
  rootDirectory?: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface SingleProjectResponse {
  message?: string;
  project: Project;
}

export interface DeleteProjectResponse {
  message: string;
}

// Deployment Payloads
export interface TriggerDeploymentResponse {
  message: string;
  deployment: Deployment;
}

export interface CreateDeploymentRequest {
  commitHash?: string;
  branch?: string;
}

export interface DeploymentsResponse {
  deployments: Deployment[];
}

export interface LatestDeploymentResponse {
  message?: string;
  deployment: Deployment | null;
}

export interface SingleDeploymentResponse {
  deployment: Deployment;
  message?: string;
}

export interface DeploymentStatusResponse {
  id: number;
  status: DeploymentStatus;
  runtimePort?: number | null;
  deploymentUrl?: string | null;
  commitHash?: string | null;
  branch?: string | null;
  updatedAt?: string;
}

export interface DeploymentLogsResponse {
  logs: DeploymentLog[];
}

export interface StopDeploymentResponse {
  message: string;
  deployment: Deployment;
}

export interface RollbackDeploymentResponse {
  message: string;
  deployment: Deployment;
}

// Environment Variables Payloads
export interface EnvVarsResponse {
  envVars: EnvironmentVariable[];
}

export interface UpsertEnvVarRequest {
  key: string;
  value: string;
}

export interface UpsertEnvVarResponse {
  message: string;
  envVar: EnvironmentVariable;
}

export interface DeleteEnvVarResponse {
  message: string;
}

// Error Format
export interface ApiError {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}
