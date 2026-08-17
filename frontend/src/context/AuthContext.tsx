import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { authApi } from '../api/auth.api';
import { TOKEN_STORAGE_KEY } from '../api/client';
import type { LoginRequest, RegisterRequest } from '../api/types';
import { AuthContext } from './authContextBase';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  // Hydrate user profile on startup if token exists
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        if (isMounted && response.user) {
          setUser(response.user);
          setToken(storedToken);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Session expired';
        console.warn('Session expired or invalid token:', msg);
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadUser();

    // Listen for global unauthorized events
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('devdeploy:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('devdeploy:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(credentials);
      if (response.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        setToken(response.token);
        setUser(response.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please verify your credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register(data);
      // Auto login after successful registration
      const loginRes = await authApi.login({ email: data.email, password: data.password });
      if (loginRes.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, loginRes.token);
        setToken(loginRes.token);
        setUser(loginRes.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
