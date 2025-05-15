// src/components/Header.jsx
import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { SupportAgent as SupportAgent} from "@mui/icons-material";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  AccountCircle,
  Settings,
  Logout,
  Brightness4, 
  Brightness7,
} from '@mui/icons-material'; 
import authService from '../services/authService'; 

const Header = ({ onLogout, onToggleTheme, currentThemeMode }) => {
  const navigate = useNavigate();
  const [anchorElUser, setAnchorElUser] = useState(null);

  const user = {
    name: 'John Smith',
    email: 'john.smith@example.com',
    avatarInitial: 'JS', 
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleNavigate = (path) => {
    navigate(path);
    handleCloseUserMenu();
  };

  const handleLogout = async () => {
    handleCloseUserMenu();
    try {
      await authService.logout(); 
      if (onLogout) {
        onLogout(); 
      }
      navigate('/login');
    } catch (error)      
      {console.error('Logout error:', error);e
      if (onLogout) {
        onLogout();
      }
      navigate('/login');
    }
  };

  return (
    <AppBar
      position="sticky" 
      sx={{
        backgroundColor: 'background.paper', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        color: 'text.primary', 
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 56, sm: 64 } }}>
        {/* Logo Section */}
        <Box sx={{ display: 'flex', alignItems: 'center'}}>
        <Box
            sx={{
              backgroundColor: 'primary.main', 
              color: 'primary.contrastText',
              fontWeight: 'bold',
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
              px: { xs: 0.5, sm: 1 },
              py: { xs: 0.25, sm: 0.5 },
              borderRadius: 1,
              mr: 1,
            }}
          >
           <SupportAgent sx={{fontSize: 28, color: "white" }} />
          </Box>
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              fontWeight: 600,
              letterSpacing: '.5px',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            No Touch Support
          </Typography>
        </Box>

        {/* Right Section: Theme Toggle (optional) & User Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Optional Theme Toggle Button */}
          {onToggleTheme && (
            <Tooltip title={`Toggle ${currentThemeMode === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton onClick={onToggleTheme} color="inherit" sx={{ mr: 1 }}>
                {currentThemeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Account settings">
            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
              <Avatar
                sx={{
                  width: { xs: 32, sm: 40 },
                  height: { xs: 32, sm: 40 },
                  bgcolor: 'secondary.main', 
                  fontSize: { xs: '0.8rem', sm: '1rem'}
                }}
                // src={user.avatarUrl} // Uncomment if using image URL
              >
                {user.avatarInitial}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            sx={{ mt: '45px' }}
            id="menu-appbar-user"
            anchorEl={anchorElUser}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            keepMounted
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.2))',
                mt: 1.5,
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': { // Arrow pointing to avatar
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={() => handleNavigate('/profile')}> {/* Placeholder path */}
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/settings')}> {/* Placeholder path */}
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;