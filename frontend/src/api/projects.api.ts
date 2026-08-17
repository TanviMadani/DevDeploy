import { apiClient } from './client';
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectsResponse,
  SingleProjectResponse,
  DeleteProjectResponse,
  TriggerDeploymentResponse,
  EnvVarsResponse,
  UpsertEnvVarResponse,
  DeleteEnvVarResponse,
} from './types';

export const projectsApi = {
  /**
   * Retrieve all projects for current user
   * GET /api/projects
   */
  async getProjects(): Promise<ProjectsResponse> {
    return apiClient<ProjectsResponse>('/projects', {
      method: 'GET',
    });
  },

  /**
   * Retrieve single project by ID
   * GET /api/projects/:id
   */
  async getProjectById(id: number): Promise<SingleProjectResponse> {
    return apiClient<SingleProjectResponse>(`/projects/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Create a new project
   * POST /api/projects
   */
  async createProject(data: CreateProjectRequest): Promise<SingleProjectResponse> {
    return apiClient<SingleProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update existing project
   * PUT /api/projects/:id
   */
  async updateProject(id: number, data: UpdateProjectRequest): Promise<SingleProjectResponse> {
    return apiClient<SingleProjectResponse>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete project
   * DELETE /api/projects/:id
   */
  async deleteProject(id: number): Promise<DeleteProjectResponse> {
    return apiClient<DeleteProjectResponse>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Trigger a deployment pipeline for project
   * POST /api/projects/:projectId/deploy
   */
  async triggerDeployment(projectId: number): Promise<TriggerDeploymentResponse> {
    return apiClient<TriggerDeploymentResponse>(`/projects/${projectId}/deploy`, {
      method: 'POST',
    });
  },

  /**
   * Retrieve environment variables for project
   * GET /api/projects/:projectId/env
   */
  async getEnvVars(projectId: number): Promise<EnvVarsResponse> {
    return apiClient<EnvVarsResponse>(`/projects/${projectId}/env`, {
      method: 'GET',
    });
  },

  /**
   * Create or update environment variable
   * POST /api/projects/:projectId/env
   */
  async upsertEnvVar(projectId: number, key: string, value: string): Promise<UpsertEnvVarResponse> {
    return apiClient<UpsertEnvVarResponse>(`/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  },

  /**
   * Delete environment variable
   * DELETE /api/projects/:projectId/env/:envId
   */
  async deleteEnvVar(projectId: number, envId: number): Promise<DeleteEnvVarResponse> {
    return apiClient<DeleteEnvVarResponse>(`/projects/${projectId}/env/${envId}`, {
      method: 'DELETE',
    });
  },
};
