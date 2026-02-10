import axios from 'axios';

const API_BASE_URL = '/api';

const ragAPI = axios.create({
  baseURL: `${API_BASE_URL}/rag`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
ragAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const aiSearch = {
  // Search clients with natural language
  searchClients: async (query, limit = 50) => {
    const response = await ragAPI.post('/search/clients', { query, limit });
    return response.data;
  },

  // Search visits with natural language
  searchVisits: async (query, limit = 50) => {
    const response = await ragAPI.post('/search/visits', { query, limit });
    return response.data;
  },

  // Trigger manual sync
  triggerSync: async () => {
    const response = await ragAPI.post('/sync/manual');
    return response.data;
  },

  // Get RAG system stats
  getStats: async () => {
    const response = await ragAPI.get('/stats');
    return response.data;
  },

  // Health check
  checkHealth: async () => {
    const response = await ragAPI.get('/health');
    return response.data;
  },
};

export default ragAPI;

