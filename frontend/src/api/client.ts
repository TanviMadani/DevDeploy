export class ApiClientError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const API_BASE_URL =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== ''
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : '/api';

export const TOKEN_STORAGE_KEY = 'devdeploy_token';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...customConfig } = options;

  let url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: requestHeaders,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error: Unable to connect to DevDeploy API server.';
    throw new ApiClientError(msg, 0);
  }

  let responseData: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const isObject = typeof responseData === 'object' && responseData !== null;
    const responseObj = isObject ? (responseData as Record<string, unknown>) : null;
    const errorMessage =
      (responseObj && typeof responseObj.message === 'string' ? responseObj.message : null) ||
      (typeof responseData === 'string' && responseData.length > 0 ? responseData : null) ||
      `Request failed with status ${response.status} (${response.statusText})`;

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('devdeploy:unauthorized'));
    }

    throw new ApiClientError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}
