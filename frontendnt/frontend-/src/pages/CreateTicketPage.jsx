import React, { useState, useCallback } from 'react';
import { useNavigate, useBeforeUnload } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  // Grid, // Grid is no longer used for the main form layout
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormHelperText, // Using FormHelperText for consistency
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import ticketService from '../services/ticketService'; // Assuming this path is correct
import { toast } from 'react-toastify';

const CreateTicketPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    description: '',
    source: 'servicenow', // Default source
  });

  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formChanged, setFormChanged] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [navigationPath, setNavigationPath] = useState('');

  useBeforeUnload(
    useCallback(
      (event) => {
        if (formChanged && !loading) {
          event.preventDefault();
          event.returnValue = '';
          return '';
        }
      },
      [formChanged, loading]
    )
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
    setFormChanged(true);
    setFormErrors((prevErrors) => ({ ...prevErrors, [name]: '' }));
  };

  const handleNavigation = (path) => {
    if (formChanged && !loading) {
      setNavigationPath(path);
      setShowConfirmDialog(true);
    } else {
      navigate(path);
    }
  };

  const handleConfirmNavigation = () => {
    setShowConfirmDialog(false);
    setFormChanged(false);
    navigate(navigationPath);
  };

  const handleCancelNavigation = () => {
    setShowConfirmDialog(false);
    setNavigationPath('');
  };

  const generateTicketId = () => {
    const now = new Date();
    const date = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
    return `TICKET_${date}_${time}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.source) errors.source = 'Please select a ticket source';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    setFormChanged(false);

    try {
      const sys_id = generateTicketId();
      await ticketService.createTicket({
        sys_id: sys_id,
        description: formData.description,
        source: formData.source,
      });
      toast.success('Ticket successfully submitted!', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      navigate('/');
    } catch (err) {
      console.error('Error submitting ticket:', err);
      toast.error(err.message || 'Failed to submit ticket. Please try again.', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setFormChanged(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      {showConfirmDialog && (
        <Dialog
          open={showConfirmDialog}
          onClose={handleCancelNavigation}
          TransitionComponent={Fade}
          TransitionProps={{ timeout: 300 }}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            },
          }}
        >
          <DialogTitle id="alert-dialog-title" sx={{ fontWeight: 600, color: '#333' }}>
            Discard unsaved changes?
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description" sx={{ color: '#666', fontSize: '0.9rem' }}>
              You have unsaved changes in your ticket. If you leave now, all information entered will be lost. Do you want to continue?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ padding: '0 24px 16px' }}>
            <Button
              onClick={handleCancelNavigation}
              variant="outlined"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
                color: '#008597',
                borderColor: '#008597',
                px: 3,
                '&:hover': {
                  backgroundColor: '#f0f7ff',
                  borderColor: '#006d7d',
                },
              }}
            >
              Stay on this page
            </Button>
            <Button
              onClick={handleConfirmNavigation}
              variant="contained"
              color="error"
              autoFocus
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
                px: 3,
                backgroundColor: '#f44336',
                '&:hover': {
                  backgroundColor: '#d32f2f',
                },
              }}
            >
              Discard changes
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Fade in timeout={500}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Tooltip title="Back to Dashboard">
                <IconButton onClick={() => handleNavigation('/')} sx={{ mr: 1 }}>
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 'medium' }}>
                Create New Ticket
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Fill in the details below to submit a new support ticket.
            </Typography>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
              <form onSubmit={handleSubmit}>
                {/* Flex container for form elements */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme => theme.spacing(3) }}>
                  {/* Item 1: Ticket Source */}
                  <FormControl component="fieldset" error={!!formErrors.source} fullWidth>
                    {/* Optional: Add a FormLabel or Typography here for "Ticket Source" title if desired */}
                    {/* e.g., <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>Ticket Source</Typography> */}
                    <RadioGroup
                      row // This makes the radio buttons (ServiceNow, Jira) appear on the same line
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                      aria-label="ticket source"
                    >
                      <FormControlLabel
                        value="servicenow"
                        control={<Radio sx={{ color: '#d0d0d0', '&.Mui-checked': { color: '#008597' } }} />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              src="/images/servicenow-logo.jpg" // Ensure this path is correct
                              alt="ServiceNow Logo"
                              style={{ height: '24px', marginRight: '8px' }}
                            />
                             {/* Optional: Add text label if needed: <Typography>ServiceNow</Typography> */}
                          </Box>
                        }
                        sx={{ mr: 4 }} // Margin to the right of the ServiceNow option
                      />
                      <FormControlLabel
                        value="jira"
                        control={<Radio sx={{ color: '#d0d0d0', '&.Mui-checked': { color: '#008597' } }} />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              src="/images/jira-logo.jpg" // Ensure this path is correct
                              alt="Jira Logo"
                              style={{ height: '60px', marginRight: '8px' }} // Note: 60px is larger, adjust if needed
                            />
                            {/* Optional: Add text label if needed: <Typography>Jira</Typography> */}
                          </Box>
                        }
                      />
                    </RadioGroup>
                    {formErrors.source && (
                      // Using FormHelperText for semantic correctness with FormControl
                      <FormHelperText error sx={{ mt: 1 }}>
                        {formErrors.source}
                      </FormHelperText>
                    )}
                  </FormControl>

                  {/* Item 2: Description */}
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder="Please provide detailed information about your issue or request"
                    error={!!formErrors.description}
                    helperText={formErrors.description} // This is MUI's built-in helper text for TextField
                    required
                    InputLabelProps={{
                      sx: {
                        fontWeight: 500,
                        color: '#666',
                        '&.Mui-focused': {
                          color: '#008597'
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        backgroundColor: '#f9fafb',
                        '& fieldset': {
                          borderColor: '#d0d0d0'
                        },
                        '&:hover fieldset': {
                          borderColor: '#008597'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#008597',
                          borderWidth: '2px'
                        }
                      },
                      '& .MuiInputBase-input': {
                        fontSize: '0.9rem',
                        color: '#333'
                      }
                    }}
                    aria-label="Ticket description"
                  />

                  {/* Item 3: Submit Button */}
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '1rem',
                        px: 4,
                        py: 1.5,
                        backgroundColor: '#008597',
                        boxShadow: '0 2px 8px rgba(0,133,151,0.3)',
                        '&:hover': {
                          backgroundColor: '#006d7d',
                          boxShadow: '0 4px 12px rgba(0,133,151,0.4)',
                          transform: 'scale(1.05)'
                        },
                        '&:disabled': {
                          backgroundColor: '#b0bec5',
                          boxShadow: 'none'
                        },
                        transition: 'all 0.2s ease'
                      }}
                      aria-label="Submit ticket"
                    >
                      {loading ? (
                        <CircularProgress size={24} sx={{ color: 'white' }} />
                      ) : (
                        'Submit Ticket'
                      )}
                    </Button>
                  </Box>
                </Box>
              </form>
            </Paper>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
};

export default CreateTicketPage;