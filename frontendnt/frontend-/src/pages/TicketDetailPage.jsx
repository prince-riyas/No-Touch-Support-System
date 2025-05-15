import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  IconButton,
  Avatar,
  Divider,
  CircularProgress,
  Fade,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Send, ThumbUp, ThumbDown, Add, Support, Person } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import ticketService from '../services/ticketService';
import config from '../config';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [showInfoInput, setShowInfoInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [openRcaModal, setOpenRcaModal] = useState(false);
  const [openPmModal, setOpenPmModal] = useState(false);
  const socket = useRef(null);
  const messagesEndRef = useRef(null);

  const PREVIEW_LENGTH = 100; // Character limit for preview text

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.current = io(`${config.api.baseUrl}`, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.current.on('connect', () => {
      socket.current.emit('join', { ticket_id: ticketId });
    });

    socket.current.on('message', (data) => {
      if (data.type === 'ticket_details') {
        setTicket(data.ticket);
        sendInitialMessage(data.ticket);
      } else if (data.type === 'text') {
        setMessages((prev) => [...prev, { sender: 'bot', text: data.text }]);
      }
    });

    socket.current.on('error', (data) => {
      console.error('Socket error:', data.message);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Error: ' + data.message,
          isError: true,
        },
      ]);
      setChatLoading(false);
    });

    fetchTicketDetails();

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const data = await ticketService.getTicketById(ticketId);
      setTicket(data);
      if (socket.current) {
        socket.current.emit('join', { ticket_id: ticketId });
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Failed to load ticket details. Please try again later.',
          isError: true,
        },
      ]);
      setChatLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const sendInitialMessage = (ticketData) => {
    const initialMessage = {
      sender: 'bot',
      text: (
        <Card
          elevation={3}
          sx={{
            borderRadius: 2,
            overflow: 'visible',
            position: 'relative',
            border: '1px solid #e0e0e0',
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box
              sx={{
                position: 'absolute',
                top: -15,
                left: 16,
                backgroundColor: '#008597',
                color: 'white',
                px: 2,
                py: 0,
                borderRadius: '4px 4px 0 0',
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                Ticket Information
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, mt: 1 }}>
              <Chip
                label={ticketData?.status || 'Unknown'}
                size="small"
                sx={{
                  backgroundColor: getStatusColor(ticketData?.status),
                  color: 'white',
                  fontWeight: 'bold',
                  px: 1,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Priority: <strong>{ticketData?.priority || 'N/A'}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assigned Team: <strong>{ticketData?.classified_team || 'Unassigned'}</strong>
              </Typography>
            </Box>

            <Typography
              variant="h6"
              color="#008597"
              gutterBottom
              sx={{
                fontWeight: 600,
                borderLeft: '4px solid #008597',
                pl: 2,
                py: 1,
              }}
            >
              {ticketData?.description?.split('\n')[0] || 'No description'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                }}
              >
                Created:{' '}
                {ticketData?.created_at
                  ? `${new Date(ticketData.created_at).toLocaleDateString()} at ${new Date(
                      ticketData.created_at
                    ).toLocaleTimeString()}`
                  : 'Unknown'}
              </Typography>
            </Box>

            {ticketData?.resolution && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="#008597" gutterBottom>
                  Resolution:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    whiteSpace: 'pre-wrap',
                    backgroundColor: '#f9f9f9',
                    p: 2,
                    borderRadius: 1,
                    borderLeft: '2px solid #008597',
                    // width: '75%',
                    // height: '75%'
                  }}
                >
                  {ticketData.resolution}
                </Typography>
              </>
            )}

            {ticketData?.status === 'more_info_needed' && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowInfoInput(true)}
                sx={{
                  mt: 3,
                  backgroundColor: '#FFDE59',
                  color: '#333',
                  '&:hover': {
                    backgroundColor: '#FFD600',
                  },
                }}
              >
                Provide Additional Information
              </Button>
            )}

            {ticketData?.status === 'feedback_needed' && (
              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" color="#008597">
                  Was the resolution helpful?
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ThumbUp />}
                    onClick={() => handleSubmitFeedback(true)}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                    }}
                  >
                    Yes, it helped
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<ThumbDown />}
                    onClick={() => handleSubmitFeedback(false)}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                    }}
                  >
                    No, I need more help
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      ),
    };
    setMessages([initialMessage]);
    setChatLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'more_info_needed':
        return '#FFDE59';
      case 'feedback_received':
        return '#2E7113';
      case 'feedback_needed':
        return '#5F9A48';
      case 'new':
        return '#E4080A';
      case 'passed to l3, processing':
        return '#FE9900';
      case 'passed to l4, team: support team':
        return '#fc6603';
      default:
        return '#9e9e9e';
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage = { sender: 'user', text: inputMessage };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    if (socket.current) {
      socket.current.emit('message', { ticket_id: ticketId, message: inputMessage });
    }

    setInputMessage('');

    setTimeout(() => {
      setSending(false);
    }, 1000);
  };

  const handleSubmitMoreInfo = async () => {
    if (!additionalInfo.trim()) return;
    try {
      setSending(true);
      await ticketService.submitMoreInfo(ticketId, additionalInfo);
      setShowInfoInput(false);
      setAdditionalInfo('');
      setMessages((prev) => [
        ...prev,
        {
          sender: 'user',
          text: `Additional information provided: ${additionalInfo}`,
        },
      ]);
      fetchTicketDetails();
      setTimeout(() => {
        setSending(false);
      }, 1000);
    } catch (err) {
      console.error('Error submitting additional info:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Failed to submit additional information. Please try again.',
          isError: true,
        },
      ]);
      setSending(false);
    }
  };

  const handleSubmitFeedback = async (isPositive) => {
    try {
      setSending(true);
      await ticketService.submitFeedback(ticketId, isPositive ? 'yes' : 'no');
      setMessages((prev) => [
        ...prev,
        {
          sender: 'user',
          text: `Feedback submitted: ${isPositive ? 'Resolution was helpful' : 'Resolution was not helpful'}`,
        },
      ]);
      fetchTicketDetails();
      setTimeout(() => {
        setSending(false);
      }, 1000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Failed to submit feedback. Please try again.',
          isError: true,
        },
      ]);
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenRcaModal = () => setOpenRcaModal(true);
  const handleCloseRcaModal = () => setOpenRcaModal(false);
  const handleOpenPmModal = () => setOpenPmModal(true);
  const handleClosePmModal = () => setOpenPmModal(false);

  const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength) + '...';
  };

  const determineTicketStates = () => {
    if (!ticket) return [];

    const states = [
      { id: 'l1', label: 'L1', active: true },
      { id: 'l2', label: 'L2', active: true },
    ];

    const status = ticket.status?.toLowerCase();
    const wentToL3 = status?.includes('l3') || status?.includes('passed to l3');
    const wentToL4 = status?.includes('l4') || status?.includes('passed to l4');

    if (wentToL3 || wentToL4) {
      if (wentToL3) {
        states.push({ id: 'l3', label: 'L3', active: true });
      }
      if (wentToL4) {
        states.push({ id: 'l4', label: 'L4', active: true });
      }
    }

    if (ticket.resolution) {
      states.push({ id: 'resolved', label: 'Resolved', active: true });
    }

    return states;
  };

  if (loading) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          bgcolor: '#f5f5f5',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <CircularProgress sx={{ color: '#008597', mt: 10 }} />
        <Typography variant="body1" sx={{ mt: 2, color: '#666' }}>
          Loading ticket data...
        </Typography>
      </Box>
    );
  }

  const states = determineTicketStates();
  const activeStep = states.length - 1;

  return (
    <Box
      sx={{
        flexGrow: 1,
        bgcolor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* RCA Modal */}
      <Dialog
        open={openRcaModal}
        onClose={handleCloseRcaModal}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
        aria-labelledby="rca-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            width: '90%',
          },
        }}
      >
        <DialogTitle id="rca-dialog-title" sx={{ fontWeight: 600, color: '#008597' }}>
          Root Cause Analysis
        </DialogTitle>
        <DialogContent>
          <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 1, borderLeft: '2px solid #008597' }}>
            <ReactMarkdown>{ticket?.rca || 'Pending Investigation'}</ReactMarkdown>
          </Box>
        </DialogContent>
        <DialogActions sx={{ padding: '0 24px 16px' }}>
          <Button
            onClick={handleCloseRcaModal}
            variant="contained"
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              bgcolor: '#008597',
              '&:hover': {
                bgcolor: '#006d7d',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* PM Modal */}
      <Dialog
        open={openPmModal}
        onClose={handleClosePmModal}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
        aria-labelledby="pm-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            width: '90%',
          },
        }}
      >
        <DialogTitle id="pm-dialog-title" sx={{ fontWeight: 600, color: '#008597' }}>
          Preventive Measures
        </DialogTitle>
        <DialogContent>
          <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 1, borderLeft: '2px solid #008597' }}>
            <ReactMarkdown>{ticket?.pm || 'To be determined'}</ReactMarkdown>
          </Box>
        </DialogContent>
        <DialogActions sx={{ padding: '0 24px 16px' }}>
          <Button
            onClick={handleClosePmModal}
            variant="contained"
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              bgcolor: '#008597',
              '&:hover': {
                bgcolor: '#006d7d',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Support Progress - Centered at the Top */}
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Stepper activeStep={activeStep} sx={{ width: '80%', maxWidth: '800px' }}>
          {states.map((state) => (
            <Step key={state.id}>
              <StepLabel
                StepIconProps={{
                  sx: {
                    '& .MuiStepIcon-root': {
                      color: state.active ? '#008597' : '#e0e0e0',
                      '&.Mui-completed': {
                        color: '#008597',
                      },
                      '&.Mui-active': {
                        color: '#008597',
                      },
                    },
                  }}
                }
              >
                <Typography variant="body2" color={state.active ? '#008597' : 'text.secondary'}>
                  {state.label}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <Box sx={{ width: '25%', display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
          {/* Queue Position */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              bgcolor: 'white',
            }}
          >
            <Typography variant="body1" fontWeight="bold" color="#008597" gutterBottom>
              Queue Position
            </Typography>
            <Box sx={{ bgcolor: '#e6f7fa', p: 2, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="#008597" fontWeight="bold">
                2
              </Typography>
              <Typography variant="body2" color="text.secondary">
                in queue
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Chip
                label="L3 Queue"
                sx={{
                  bgcolor: '#e0e0e0',
                  color: '#333',
                }}
              />
            </Box>
          </Paper>

          {/* Root Cause Analysis */}
          <Paper
            elevation={0}
            sx={{
              p: 1,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              bgcolor: 'white',
            }}
          >
            <Typography variant="body1" fontWeight="bold" color="#008597" gutterBottom>
              Root Cause Analysis
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'normal',
              }}
            >
              {truncateText(ticket?.rca || 'Pending Investigation', PREVIEW_LENGTH)}
            </Typography>
            {ticket?.rca && ticket.rca.length > PREVIEW_LENGTH && (
              <Button
                variant="text"
                onClick={handleOpenRcaModal}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  color: '#008597',
                  '&:hover': {
                    backgroundColor: 'rgba(0,133,151,0.05)',
                  },
                }}
              >
                View More
              </Button>
            )}
          </Paper>

          {/* Preventive Measures */}
          <Paper
            elevation={0}
            sx={{
              p: 1,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              bgcolor: 'white',
            }}
          >
            <Typography variant="body1" fontWeight="bold" color="#008597" gutterBottom>
              Preventive Measures
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'normal',
              }}
            >
              {truncateText(ticket?.pm || 'To be determined', PREVIEW_LENGTH)}
            </Typography>
            {ticket?.pm && ticket.pm.length > PREVIEW_LENGTH && (
              <Button
                variant="text"
                onClick={handleOpenPmModal}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  color: '#008597',
                  '&:hover': {
                    backgroundColor: 'rgba(0,133,151,0.05)',
                  },
                }}
              >
                View More
              </Button>
            )}
          </Paper>
        </Box>

        {/* Right Side: Chat Interface */}
        <Box sx={{ width: '85%', display: 'flex', flexDirection: 'column', p: 3, pr: 3, pt: 1, pb: 0 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'white',
              height: '50%',
            }}
          >
            {/* Chat Header */}
            <Box
              sx={{
                p: 1,
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" fontWeight="bold" color="#008597">
                  Support Chat
                </Typography>
                <Chip
                  label="Active"
                  sx={{
                    bgcolor: '#e6f7fa',
                    color: '#008597',
                    fontWeight: 'bold',
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                <strong>({ticketId})</strong>
              </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Last updated: 13/5/2025, 7:30:00 pm
              </Typography>
            </Box>

            {/* Chat Messages */}
            <Box
              sx={{
                p: 2,
                overflowY: 'auto',
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                height: 'calc(100vh - 250px)', // Simplified height calculation
                width: '100%'
              }}
            >
              {chatLoading && messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                  <CircularProgress size={30} sx={{ color: '#008597' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    Loading chat...
                  </Typography>
                </Box>
              ) : (
                <>
                  {messages.map((msg, index) => (
                    <Fade in={true} key={index} timeout={300}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                          mb: 1,
                          width: '100%',
                          // height: '75%'
                        }}
                      >
                        {msg.sender === 'bot' && (
                          <Avatar
                            sx={{
                              bgcolor: '#008597',
                              width: 36,
                              height: 36,
                              mr: 1,
                              alignSelf: 'flex-end',
                              mb: 0.5,
                            }}
                          >
                            <Support fontSize="small" />
                          </Avatar>
                        )}

                        <Box
                          sx={{
                            maxWidth: '70%',
                            p: typeof msg.text === 'string' ? 2 : 0,
                            bgcolor: msg.sender === 'user'
                              ? '#e0f2f1'
                              : msg.isError
                              ? '#ffebee'
                              : '#e6f7fa',
                            color: msg.isError ? '#d32f2f' : 'inherit',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: msg.sender === 'user'
                              ? '#b2dfdb'
                              : msg.isError
                              ? '#ffcdd2'
                              : '#b2dfdb',
                            wordBreak: 'break-word',
                          }}
                        >
                          {typeof msg.text === 'string' ? (
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          ) : (
                            msg.text
                          )}
                        </Box>

                        {msg.sender === 'user' && (
                          <Avatar
                            sx={{
                              bgcolor: '#4db6ac',
                              width: 36,
                              height: 36,
                              ml: 1,
                              alignSelf: 'flex-end',
                              mb: 0.5,
                            }}
                          >
                            <Person fontSize="small" />
                          </Avatar>
                        )}
                      </Box>
                    </Fade>
                  ))}

                  {sending && (
                    <Box sx={{ display: 'flex', alignItems: 'center', pl: 2 }}>
                      <CircularProgress size={20} sx={{ color: '#008597', mr: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        Processing...
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Additional Info Input */}
            {showInfoInput && (
              <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#f0f7f7' }}>
                <Typography variant="body2" color="#008597" gutterBottom>
                  Please provide the additional information requested:
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Enter additional information..."
                  variant="outlined"
                  sx={{
                    mt: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      '&:hover fieldset': {
                        borderColor: '#008597',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#008597',
                      },
                    },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowInfoInput(false)}
                    sx={{
                      borderColor: '#008597',
                      color: '#008597',
                      '&:hover': {
                        borderColor: '#006d7e',
                        bgcolor: 'rgba(0,133,151,0.05)',
                      },
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSubmitMoreInfo}
                    disabled={!additionalInfo.trim() || sending}
                    sx={{
                      bgcolor: '#008597',
                      '&:hover': {
                        bgcolor: '#006d7e',
                      },
                      '&.Mui-disabled': {
                        bgcolor: '#b2dfdb',
                      },
                    }}
                  >
                    Submit
                  </Button>
                </Box>
              </Box>
            )}

            {/* Chat Input */}
            <Box sx={{ p: 1, borderTop: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2}}>
                <TextField
                  fullWidth
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: '#008597',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#008597',
                      },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || sending}
                  sx={{
                    bgcolor: '#008597',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: '#006d7e',
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#b2dfdb',
                    },
                  }}
                  startIcon={<Send />}
                >
                  Send
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default TicketDetailPage;