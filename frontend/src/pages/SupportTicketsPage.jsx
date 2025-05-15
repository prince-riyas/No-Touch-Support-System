import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Paper,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as EyeIcon,
  ErrorOutline as ErrorOutlineIcon,
  SmsFailedOutlined as NoTicketsIcon,
  WatchLaterOutlined as OpenTicketIconMui,
  CachedOutlined as InProgressIconMui,
  CheckCircleOutlineOutlined as ResolvedIconMui,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import ticketService from '../services/ticketService';

const getStatusChipProps = (status) => {
  const s = status?.toLowerCase() || 'unknown';
  if (s.includes('progress') || s.includes('l3') || s.includes('l4') || s.includes('processing')) {
    return { label: status, color: 'info', sx: { color: '#fff', backgroundColor: '#0288d1' } };
  }
  if (s === 'open' || s === 'new') {
    return { label: status, color: 'warning', sx: { color: '#fff', backgroundColor: '#f57c00' } };
  }
  if (s.includes('pending') || s.includes('info')) {
    return { label: status, color: 'secondary', sx: { color: '#fff', backgroundColor: '#673ab7' } };
  }
  if (s === 'resolved' || s === 'closed') {
    return { label: status, color: 'success', sx: { color: '#fff', backgroundColor: '#388e3c' } };
  }
  return { label: status || 'N/A', color: 'default' };
};

const getPriorityChipProps = (priority) => {
  const p = priority?.toLowerCase() || 'unknown';
  if (p === 'high' || p === 'urgent') {
    return { label: priority, color: 'error', sx: { color: '#fff', backgroundColor: '#d32f2f' } };
  }
  if (p === 'medium') {
    return { label: priority, color: 'warning', sx: { color: '#fff', backgroundColor: '#f57c00' } };
  }
  if (p === 'low') {
    return { label: priority, color: 'info', sx: { color: '#fff', backgroundColor: '#1976d2' } };
  }
  return { label: priority || 'N/A', color: 'default' };
};

const StatCard = ({ title, value, icon, loading }) => (
  <Card sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, height: '100%', boxShadow: 3 }}>
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>
        {loading ? <CircularProgress size={28} thickness={4} /> : value}
      </Typography>
    </Box>
    <Box sx={{ color: 'primary.main', fontSize: '2.5rem' }}>{icon}</Box>
  </Card>
);

const SourceSelectorCard = ({ selectedSource, onPrev, onNext }) => (
  <Card sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, height: '100%', boxShadow: 3 }}>
    <IconButton
      onClick={onPrev}
      sx={{ color: '#008597', '&:hover': { bgcolor: 'rgba(0,133,151,0.05)' } }}
      aria-label="Previous source"
    >
      <ChevronLeftIcon />
    </IconButton>
    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60px' }}>
      {selectedSource === 'servicenow' ? (
        <img
          src="/images/servicenow-logo.jpg"
          alt="ServiceNow logo"
          style={{ maxHeight: '60px', maxWidth: '120px', objectFit: 'contain' }}
        />
      ) : selectedSource === 'jira' ? (
        <img
          src="/images/jira-logo.jpg"
          alt="Jira logo"
          style={{ maxHeight: '60px', maxWidth: '120px', objectFit: 'contain' }}
        />
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 'medium', fontSize: '16px' }}>
          All Tickets
        </Typography>
      )}
    </Box>
    <IconButton
      onClick={onNext}
      sx={{ color: '#008597', '&:hover': { bgcolor: 'rgba(0,133,151,0.05)' } }}
      aria-label="Next source"
    >
      <ChevronRightIcon />
    </IconButton>
  </Card>
);

const SupportTicketsPage = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
  });

  const sources = ['servicenow', 'jira', 'all'];
  const [sourceIndex, setSourceIndex] = useState(2); // Default to 'all'

  const handlePrevSource = () => {
    setSourceIndex((prev) => (prev === 0 ? sources.length - 1 : prev - 1));
    setSourceFilter(sources[sourceIndex === 0 ? sources.length - 1 : sourceIndex - 1]);
  };

  const handleNextSource = () => {
    setSourceIndex((prev) => (prev === sources.length - 1 ? 0 : prev + 1));
    setSourceFilter(sources[sourceIndex === sources.length - 1 ? 0 : sourceIndex + 1]);
  };

  const calculateStats = (ticketList) => {
    const openCount = ticketList.filter((t) =>
      ['more_info_needed', 'feedback_needed', 'passed to l3, processing', 'passed to l4, processing']
        .includes(t.status?.toLowerCase())
    ).length;
    const inProgressCount = ticketList.filter(
      (t) =>
        (t.status?.toLowerCase().includes('progress') ||
         t.status?.toLowerCase().includes('l3') ||
         t.status?.toLowerCase().includes('l4')) &&
        !['passed to l3, processing', 'passed to l4, processing'].includes(t.status?.toLowerCase())
    ).length;
    const resolvedCount = ticketList.filter((t) => t.status?.toLowerCase() === 'resolved').length;
    return {
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
    };
  };

  useEffect(() => {
    const fetchTicketsAndStats = async () => {
      try {
        setLoading(true);
        const ticketsData = await ticketService.getTickets();
        const sortedTickets = ticketsData.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        setTickets(sortedTickets);
        setStats(calculateStats(sortedTickets));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
        setError('Failed to load tickets. Please try again later.');
        setTickets([]);
        setStats({ open: 0, inProgress: 0, resolved: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchTicketsAndStats();
  }, []);

  useEffect(() => {
    let currentTickets = [...tickets];
    if (sourceFilter !== 'all') {
      currentTickets = currentTickets.filter((ticket) => ticket.source?.toLowerCase() === sourceFilter);
    }
    if (searchTerm) {
      currentTickets = currentTickets.filter(
        (ticket) =>
          ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      currentTickets = currentTickets.filter((ticket) => ticket.status?.toLowerCase() === statusFilter.toLowerCase());
    }
    if (priorityFilter !== 'all') {
      currentTickets = currentTickets.filter((ticket) => ticket.priority?.toLowerCase() === priorityFilter.toLowerCase());
    }
    setFilteredTickets(currentTickets);
    setStats(calculateStats(currentTickets));
  }, [searchTerm, statusFilter, priorityFilter, sourceFilter, tickets]);

  const uniqueStatuses = ['all', ...new Set(tickets.map((t) => t.status?.toLowerCase()).filter(Boolean))];
  const uniquePriorities = ['all', ...new Set(tickets.map((t) => t.priority?.toLowerCase()).filter(Boolean))];

  return (
    <Container maxWidth="xl" sx={{ py: 3, backgroundColor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      {/* Stats Cards */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          mb: 3,
        }}
      >
        <Box
          sx={{
            flex: { xs: '1 0 100%', sm: '1 0 calc(50% - 12px)', md: '1 0 calc(33.333% - 16px)' },
            minWidth: 0,
          }}
        >
          <SourceSelectorCard
            selectedSource={sourceFilter}
            onPrev={handlePrevSource}
            onNext={handleNextSource}
          />
        </Box>
        <Box
          sx={{
            flex: { xs: '1 0 100%', sm: '1 0 calc(50% - 12px)', md: '1 0 calc(33.333% - 16px)' },
            minWidth: 0,
          }}
        >
          <StatCard
            title="Open Tickets"
            value={stats.open}
            icon={<OpenTicketIconMui sx={{ fontSize: '2.5rem' }} />}
            loading={loading}
          />
        </Box>
        <Box
          sx={{
            flex: { xs: '1 0 100%', sm: '1 0 100%', md: '1 0 calc(33.333% - 16px)' },
            minWidth: 0,
          }}
        >
          <StatCard
            title="Resolved Tickets"
            value={stats.resolved}
            icon={<ResolvedIconMui sx={{ fontSize: '2.5rem' }} />}
            loading={loading}
          />
        </Box>
      </Box>

      {/* Tickets Section Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'medium' }}>
          Support Tickets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage and respond to customer support tickets.
        </Typography>
      </Box>

      {/* Filter and Action Bar */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search tickets..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200, md: 250 } }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            displayEmpty
          >
            {uniqueStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: '1 0 100%', sm: 150 } }}>
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            displayEmpty
          >
            {uniquePriorities.map((priority) => (
              <MenuItem key={priority} value={priority}>
                {priority === 'all' ? 'All Priorities' : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/add-ticket')}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Create New Ticket
        </Button>
      </Paper>

      {/* Tickets Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'error.lighter', color: 'error.dark' }}>
          <ErrorOutlineIcon sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h6">{error}</Typography>
        </Paper>
      ) : filteredTickets.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <NoTicketsIcon sx={{ fontSize: 60, mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">No tickets found.</Typography>
          <Typography>Try adjusting your filters or create a new ticket.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table sx={{ minWidth: 650 }} aria-label="support tickets table">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Ticket ID</TableCell>
                <TableCell sx={{ minWidth: 250 }}>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assigned Team</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow
                  key={ticket.ticket_id}
                  hover
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {ticket.ticket_id}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={ticket.description?.split('\n')[0] || 'No description'} placement="top-start">
                      <span>
                        {ticket.description?.split('\n')[0]?.substring(0, 60) || 'No description'}
                        {ticket.description?.split('\n')[0]?.length > 60 ? '...' : ''}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip {...getStatusChipProps(ticket.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip {...getPriorityChipProps(ticket.priority)} size="small" />
                  </TableCell>
                  <TableCell>
                    {ticket.classified_team ? ticket.classified_team.replace('Passed to ', '').split(',')[0].substring(0, 15) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.updated_at || ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EyeIcon />}
                      component={RouterLink}
                      to={`/tickets/${ticket.ticket_id}`}
                      sx={{ textTransform: 'none' }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default SupportTicketsPage;