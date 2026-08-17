import { apiClient } from './client';
import type {
  DeploymentsResponse,
  LatestDeploymentResponse,
  SingleDeploymentResponse,
  DeploymentStatusResponse,
  DeploymentLogsResponse,
  StopDeploymentResponse,
  TriggerDeploymentResponse,
  CreateDeploymentRequest,
} from './types';

export const deploymentsApi = {
  /**
   * Get all deployments for a project
   * GET /api/projects/:projectId/deployments
   */
  async getProjectDeployments(projectId: number): Promise<DeploymentsResponse> {
    return apiClient<DeploymentsResponse>(`/projects/${projectId}/deployments`, {
      method: 'GET',
    });
  },

  /**
   * Get the latest deployment for a project
   * GET /api/projects/:projectId/deployments/latest
   */
  async getLatestDeployment(projectId: number): Promise<LatestDeploymentResponse> {
    return apiClient<LatestDeploymentResponse>(`/projects/${projectId}/deployments/latest`, {
      method: 'GET',
    });
  },

  /**
   * Trigger a new deployment for a project
   * POST /api/projects/:projectId/deploy
   */
  async triggerDeployment(projectId: number): Promise<TriggerDeploymentResponse> {
    return apiClient<TriggerDeploymentResponse>(`/projects/${projectId}/deploy`, {
      method: 'POST',
    });
  },

  /**
   * Create a deployment with specific commit/branch
   * POST /api/projects/:projectId/deployments
   */
  async createDeployment(
    projectId: number,
    data: CreateDeploymentRequest
  ): Promise<TriggerDeploymentResponse> {
    return apiClient<TriggerDeploymentResponse>(`/projects/${projectId}/deployments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get deployment by ID
   * GET /api/deployments/:id
   */
  async getDeploymentById(id: number): Promise<SingleDeploymentResponse> {
    return apiClient<SingleDeploymentResponse>(`/deployments/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Get deployment status
   * GET /api/deployments/:id/status
   */
  async getDeploymentStatus(id: number): Promise<DeploymentStatusResponse> {
    return apiClient<DeploymentStatusResponse>(`/deployments/${id}/status`, {
      method: 'GET',
    });
  },

  /**
   * Get deployment logs
   * GET /api/deployments/:id/logs
   */
  async getDeploymentLogs(id: number): Promise<DeploymentLogsResponse> {
    return apiClient<DeploymentLogsResponse>(`/deployments/${id}/logs`, {
      method: 'GET',
    });
  },

  /**
   * Stop a running deployment
   * POST /api/deployments/:id/stop
   */
  async stopDeployment(id: number): Promise<StopDeploymentResponse> {
    return apiClient<StopDeploymentResponse>(`/deployments/${id}/stop`, {
      method: 'POST',
    });
  },

  /**
   * Rollback to a specific deployment version
   * POST /api/deployments/:id/rollback
   */
  async rollbackDeployment(id: number): Promise<TriggerDeploymentResponse> {
    return apiClient<TriggerDeploymentResponse>(`/deployments/${id}/rollback`, {
      method: 'POST',
    });
  },
};
