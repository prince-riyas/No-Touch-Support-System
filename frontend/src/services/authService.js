// src/services/authService.js

import config from '../config';

export const authService = {
  async register(email, password) {
    try {
      const response = await fetch(`${config.api.baseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async login(email, password) {
    try {
        const response = await fetch(`${config.api.baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }
      
      // Store tokens in localStorage
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      
      // Set token expiration (assuming 30 minutes from now)
      const expiresAt = Date.now() + 30 * 60 * 1000;
      localStorage.setItem("tokenExpiresAt", expiresAt);
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async logout() {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (refreshToken) {
        const response = await fetch(`${config.api.baseUrl}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        // Clear tokens regardless of response
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");

        return await response.json();
      }
      
      // If no refresh token exists, just clear localStorage
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      
      return { message: "Logged out locally" };
    } catch (error) {
      // Still clear tokens on error
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      throw error;
    }
  },

  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }
      const response = await fetch(`${config.api.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Token refresh failed");
      }
      
      // Update access token in localStorage
      localStorage.setItem("accessToken", data.access_token);
      

      // Update expiration time (30 minutes from now)
      const expiresAt = Date.now() + 30 * 60 * 1000;
      localStorage.setItem("tokenExpiresAt", expiresAt);
      
      return data;
    } catch (error) {
      // Clear tokens on refresh error
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("tokenExpiresAt");
      throw error;
    }
  },

   // Add method to check if token is expired or will expire soon
   isTokenExpired(timeBuffer = 0) {
    const expiresAt = localStorage.getItem("tokenExpiresAt");
    if (!expiresAt) return true;
    
    // Return true if token is expired or will expire within the buffer time
    return Date.now() + timeBuffer > parseInt(expiresAt);
  },

  // Add method to check if token is expired or will expire soon
  isTokenExpired(timeBuffer = 0) {
    const expiresAt = localStorage.getItem("tokenExpiresAt");
    if (!expiresAt) return true;
    
    // Return true if token is expired or will expire within the buffer time
    return Date.now() + timeBuffer > parseInt(expiresAt);
  },

  // Create a method to get a valid token
  async getValidToken() {
    // If token is expired or will expire in the next minute, refresh it
    if (this.isTokenExpired(60000)) {
      try {
        await this.refreshToken();
      } catch (error) {
        // If refresh fails, clear auth state
        this.logout();
        throw new Error("Session expired. Please log in again.");
      }
    }
    
    return localStorage.getItem("accessToken");
  },

  getAuthHeader() {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  isAuthenticated() {
    return !!localStorage.getItem("accessToken");
  },
};

export default authService;