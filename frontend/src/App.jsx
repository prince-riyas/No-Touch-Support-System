// src/App.jsx
import React, { useState, useEffect, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, IconButton } from "@mui/material";
import { Brightness4, Brightness7 } from '@mui/icons-material';


// Import MUI Page Components
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SupportTicketsPage from "./pages/SupportTicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import Header from "./components/Header"; // MUI Header

import authService from "./services/authService";

// Helper component to manage redirects based on auth state for login/register pages
const AuthRedirector = ({ isLoggedIn }) => {
  const location = useLocation();
  if (isLoggedIn && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to="/" replace />;
  }
  return null;
};

// Protected Route Component
const ProtectedRoute = ({ isLoggedIn, isLoading, children }) => {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
};


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'dark'); // Persist theme

  // MUI Theme Definition
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: themeMode === 'dark' ? '#22D3EE' : '#008597', // Cyan-ish accent for dark, original for light
          },
          secondary: {
            main: themeMode === 'dark' ? '#673ab7' : '#f50057', // Example secondary
          },
          background: {
            default: themeMode === 'dark' ? '#0F172A' : '#f5f7fa', // slate-900 for dark, light grey for light
            paper: themeMode === 'dark' ? '#1E293B' : '#ffffff',   // slate-800 for dark, white for light
          },
          text: {
            primary: themeMode === 'dark' ? '#F1F5F9' : '#212121',
            secondary: themeMode === 'dark' ? '#94A3B8' : '#757575',
          },
          action: { // For hover states, etc.
            hover: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            selected: themeMode === 'dark' ? 'rgba(34, 211, 238, 0.16)' : 'rgba(0, 133, 151, 0.08)', // Accent color selection
          }
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          // You can define other typography settings here
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none', // No uppercase buttons by default
                        borderRadius: 8,
                    }
                }
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                    }
                }
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                    size: 'small',
                }
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 'medium',
                    }
                }
            }
        }
      }),
    [themeMode]
  );

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };


  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const authenticated = authService.isAuthenticated();
        setIsLoggedIn(authenticated);
      } catch (error) {
        console.error("Auth check failed on app load:", error);
        authService.logout();
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    // toast.success("Successfully logged in!"); // LoginPage handles its navigation
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    // toast.success("You have been logged out"); // Header handles its navigation
  };

  const handleRegisterSuccess = () => {
    // Toast is in RegisterPage
  };
  
  // Show a global loader only if initial auth check is in progress AND user is not on an auth page already
  // This prevents brief flash of auth pages if already logged in.
  if (isLoading && typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ml:2}}>Initializing...</Typography>
        </Box>
      </ThemeProvider>
    );
  }


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Ensures consistent baseline styling */}
      <Router>
        <AuthRedirector isLoggedIn={isLoggedIn} />
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
          {isLoggedIn && !isLoading && <Header onLogout={handleLogout} onToggleTheme={handleToggleTheme} currentThemeMode={themeMode} />}
          <Box component="main" sx={{ flexGrow: 1, overflowY: 'auto' /* Allow main content to scroll if needed */ }}>
            <Routes>
              <Route 
                path="/login"
                element={isLoggedIn && !isLoading ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
              />
              <Route 
                path="/register"
                element={isLoggedIn && !isLoading ? <Navigate to="/" replace /> : <RegisterPage onRegisterSuccess={handleRegisterSuccess} />}
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading}>
                    <SupportTicketsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/tickets/:ticketId"  
                element={
                  <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading}>
                    <TicketDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/add-ticket" 
                element={
                  <ProtectedRoute isLoggedIn={isLoggedIn} isLoading={isLoading}>
                    <CreateTicketPage />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="*" 
                element={
                  <Navigate to={isLoggedIn && !isLoading ? "/" : "/login"} replace />
                } 
              />
            </Routes>
          </Box>
        </Box>
        <ToastContainer 
          position="top-right" 
          autoClose={3000} 
          theme={themeMode} // Use MUI theme mode for toast
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;