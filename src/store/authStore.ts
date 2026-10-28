import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import type { User, AuthState, JwtPayload } from '@/types';

interface AuthStore extends AuthState {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isTokenExpired: () => boolean;
  refreshAccessToken: (newToken: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      isTokenExpired: () => {
        const { accessToken } = get();
        if (!accessToken) return true;

        try {
          const decoded = jwtDecode<JwtPayload>(accessToken);
          const currentTime = Date.now() / 1000;
          return decoded.exp < currentTime;
        } catch {
          return true;
        }
      },

      refreshAccessToken: (newToken) => {
        set({ accessToken: newToken });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
