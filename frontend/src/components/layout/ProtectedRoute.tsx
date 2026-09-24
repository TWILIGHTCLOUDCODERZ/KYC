import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader } from '../common/LoadingSpinner';
import { isAdminRole } from '../../types/database';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Send admins to their dashboard, not customer dashboard
    return <Navigate to={isAdminRole(profile.role) ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}
