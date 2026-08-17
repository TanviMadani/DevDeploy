import { apiClient } from './client';
import type { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, GetMeResponse } from './types';

export const authApi = {
  /**
   * Register a new user account
   * POST /api/auth/register
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Login user and retrieve JWT token
   * POST /api/auth/login
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Fetch authenticated user profile
   * GET /api/auth/me
   */
  async getMe(): Promise<GetMeResponse> {
    return apiClient<GetMeResponse>('/auth/me', {
      method: 'GET',
    });
  },
};
