import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// =================================================================================
// AUTH
// =================================================================================

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  changePassword: (passwords) => api.post('/auth/change-password', passwords),
  register: (userData) => api.post('/auth/register', userData),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  getPreferences: () => api.get('/auth/preferences'),
  updatePreferences: (preferences) => api.put('/auth/preferences', { preferences }),
};

// =================================================================================
// CHAT
// =================================================================================

export const chatAPI = {
  getOnlineUsers: () => api.get('/chat/users/online'),
  createConversation: (participantId) => api.post('/chat/conversations', { participantId }),
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (conversationId, params) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  uploadFile: (formData) => api.post('/chat/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// =================================================================================
// CLIENTS
// =================================================================================

export const clientsAPI = {
  getAll: (params) => api.get('/clients', { params }),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  bulkDelete: (ids) => api.delete('/clients/bulk', { data: { ids } }),
  getStats: () => api.get('/clients/stats/summary'),
  getFilterOptions: () => api.get('/clients/filters/options'),
  exportToExcel: (params) => api.get('/clients/export', { params, responseType: 'blob' }),
};

// =================================================================================
// SERVICES
// =================================================================================

export const servicesAPI = {
  getByClient: (clientId, params) => api.get(`/services/client/${clientId}`, { params }),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

// =================================================================================
// CONTRACTS
// =================================================================================

export const contractsAPI = {
  getByClient: (clientId) => api.get(`/contracts/client/${clientId}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  delete: (id) => api.delete(`/contracts/${id}`),
};

// =================================================================================
// INDIVIDUAL PLANS
// =================================================================================

export const plansAPI = {
  getByClient: (clientId) => api.get(`/plans/client/${clientId}`),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`),
};

// =================================================================================
// DASHBOARD
// =================================================================================

export const dashboardAPI = {
  getData: () => api.get('/dashboard'),
};

// =================================================================================
// WORKERS
// =================================================================================

export const workersAPI = {
  getAll: (params) => api.get('/workers', { params }),
  getById: (id) => api.get(`/workers/${id}`),
  getStats: () => api.get('/workers/stats'),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  delete: (id) => api.delete(`/workers/${id}`),
};

// =================================================================================
// NOTES
// =================================================================================

export const notesAPI = {
  getByClient: (clientId) => api.get(`/notes/client/${clientId}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
};

// =================================================================================
// SANCTIONS
// =================================================================================

export const sanctionsAPI = {
  getByClient: (clientId) => api.get(`/sanctions/client/${clientId}`),
  create: (data) => api.post('/sanctions', data),
  update: (id, data) => api.put(`/sanctions/${id}`, data),
  delete: (id) => api.delete(`/sanctions/${id}`),
};

// =================================================================================
// TAGS
// =================================================================================

export const tagsAPI = {
  getAll: () => api.get('/tags'),
  create: (data) => api.post('/tags', data),
  delete: (id) => api.delete(`/tags/${id}`),
};

// =================================================================================
// REPORTS
// =================================================================================

export const reportsAPI = {
  getExecutiveDashboard: (params) => api.get('/reports/executive-dashboard', { params }),
  getDemographics: () => api.get('/reports/demographics'),
  getServicesAnalytics: (params) => api.get('/reports/services-analytics', { params }),
  getClientTimeline: () => api.get('/reports/client-timeline'),
  getAlerts: () => api.get('/reports/alerts'),
  getEngagement: () => api.get('/reports/engagement'),
  generate: (type, params) => api.get(`/reports/${type}`, { params }),
  export: (type, params) => api.get(`/reports/${type}/export`, { params, responseType: 'blob' }),
};

// =================================================================================
// WALL
// =================================================================================

export const wallAPI = {
  getPosts: (params) => api.get('/wall/posts', { params }),
  createPost: (data) => api.post('/wall/posts', data),
  updatePost: (id, data) => api.put(`/wall/posts/${id}`, data),
  deletePost: (id) => api.delete(`/wall/posts/${id}`),
  pinPost: (id, pinned) => api.put(`/wall/posts/${id}/pin`, { pinned }),
  likePost: (id) => api.post(`/wall/posts/${id}/like`),
  getComments: (postId) => api.get(`/wall/posts/${postId}/comments`),
  addComment: (postId, content, parentCommentId = null) => api.post(`/wall/posts/${postId}/comments`, { content, parent_comment_id: parentCommentId }),
  deleteComment: (commentId) => api.delete(`/wall/comments/${commentId}`),
};

// =================================================================================
// VISITS
// =================================================================================

export const visitsAPI = {
  getAll: (params) => api.get('/visits', { params }),
  getById: (id) => api.get(`/visits/${id}`),
  create: (data) => api.post('/visits', data),
  update: (id, data) => api.put(`/visits/${id}`, data),
  delete: (id) => api.delete(`/visits/${id}`),
  getReasons: () => api.get('/visits/reasons/all'),
  getStats: (params) => api.get('/visits/stats/summary', { params }),
  getFilterOptions: () => api.get('/visits/filter-options'),
  exportToExcel: (params) => api.get('/visits/export', { params, responseType: 'blob' }),
};

// =================================================================================
// VOTING
// =================================================================================

export const votingAPI = {
  getAll: (params) => api.get('/voting', { params }),
  getById: (id) => api.get(`/voting/${id}`),
  create: (data) => api.post('/voting', data),
  respond: (id, data) => api.post(`/voting/${id}/respond`, data),
  delete: (id) => api.delete(`/voting/${id}`),
  toggle: (id) => api.patch(`/voting/${id}/toggle`),
};

// =================================================================================
// WEEKLY PLANNER
// =================================================================================

export const plannerAPI = {
  getAll: (params) => api.get('/planner', { params }),
  getById: (id) => api.get(`/planner/${id}`),
  create: (data) => api.post('/planner', data),
  update: (id, data) => api.put(`/planner/${id}`, data),
  delete: (id) => api.delete(`/planner/${id}`),

  // Activities
  createActivity: (plannerId, data) => api.post(`/planner/${plannerId}/activities`, data),
  updateActivity: (plannerId, activityId, data) => api.put(`/planner/${plannerId}/activities/${activityId}`, data),
  deleteActivity: (plannerId, activityId) => api.delete(`/planner/${plannerId}/activities/${activityId}`),

  // Reference data
  getActivityTypes: () => api.get('/planner/reference/activity-types'),
  getRooms: () => api.get('/planner/reference/rooms'),
};

export default api;
