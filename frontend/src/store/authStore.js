import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      set({ 
        user: { ...user, token }, 
        token, 
        isAuthenticated: true, 
        isLoading: false 
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ 
      user: null, 
      token: null, 
      isAuthenticated: false 
    });
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const response = await authAPI.me();
      set({ user: { ...response.data.user, token } });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      set({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),
}));

export default useAuthStore;


























