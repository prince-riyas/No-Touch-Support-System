// src/services/api.js

import config from '../config';
import authService from './authService';

export const api = {
  async fetch(url, options = {}) {
    try {
      // Get a valid token first (refreshes if needed)
      const token = await authService.getValidToken();
      
      // Add authorization header
      const headers = {
        ...options.headers,
        "Authorization": `Bearer ${token}`
      };
      
      // Make the API request
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle 401 errors (in case token was invalidated server-side)
      if (response.status === 401) {
        // Try one more token refresh
        try {
          await authService.refreshToken();
          const newToken = localStorage.getItem("accessToken");
          
          // Retry the request with the new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              "Authorization": `Bearer ${newToken}`
            }
          });
          
          return retryResponse;
        } catch (refreshError) {
          // If refresh fails, log out and throw error
          authService.logout();
          throw new Error("Session expired. Please log in again.");
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
};

// Add convenience methods for common HTTP methods
["get", "post", "put", "delete", "patch"].forEach(method => {
  api[method] = async (url, options = {}) => {
    return api.fetch(url, {
      ...options,
      method: method.toUpperCase()
    });
  };
});

export default api;