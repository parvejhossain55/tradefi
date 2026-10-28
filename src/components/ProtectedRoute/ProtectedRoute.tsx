import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isTokenExpired } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || isTokenExpired()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
