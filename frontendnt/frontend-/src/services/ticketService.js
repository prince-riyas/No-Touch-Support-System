import config from '../config';
import api from './api';

export const ticketService = {
  async getTickets() {
    try {
      const response = await api.get(`${config.api.baseUrl}/api/incidents`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tickets");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async getTicketById(ticketId) {
    try {
      const response = await api.get(`${config.api.baseUrl}/api/incidents/${ticketId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch ticket details");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async createTicket(ticketData) {
    try {
      const response = await api.post(`${config.api.baseUrl}/api/process_ticket`, {
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sys_id: ticketData.sys_id || Date.now().toString(),
          description: ticketData.description,
          source: ticketData.source
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to create ticket");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },
  
  async submitFeedback(ticketId, feedback) {
    try {
      const response = await api.post(`${config.api.baseUrl}/api/feedback`, {
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          sys_id: ticketId, 
          feedback 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async submitMoreInfo(ticketId, additionalInfo) {
    try {
      const response = await api.post(`${config.api.baseUrl}/api/more_info`, {
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          sys_id: ticketId, 
          additional_info: additionalInfo 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit additional information");
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async getTicketStateCount(state = 'all') {
    try {
      const url = `${config.api.baseUrl}/api/ticket-state-count${state !== 'all' ? `?state=${encodeURIComponent(state)}` : ''}`;
      const response = await api.get(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch ticket state count");
      }
      return data || {};
    } catch (error) {
      throw new Error(error.message || "Failed to fetch ticket state count");
    }
  }
};

export default ticketService;