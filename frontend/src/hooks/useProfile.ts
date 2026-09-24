import { useAuth } from '../contexts/AuthContext';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  return { profile, refreshProfile };
}
