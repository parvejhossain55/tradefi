import axios from 'axios';
import type { LoginCredential, RegisterCredentials, UserResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const authApi = {
  async login(creadential: LoginCredential): Promise<UserResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, creadential);
    return response.data;
  },

  async register(credential: RegisterCredentials): Promise<UserResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, credential);
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    await axios.post(`${API_BASE_URL}/auth/logout`);
  },
};
