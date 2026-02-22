import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';

/**
 * Returns true if the current user can perform admin actions for the current league.
 * True for site admins (global) and the league's commissioner.
 */
export function useCanManageLeague() {
  const { role } = useAuth();
  const { isLeagueManager } = useLeague();
  return role === 'admin' || isLeagueManager;
}

/**
 * Returns true if the current user is a site-level admin.
 * Use for global operations: player uploads, migration, cross-league tools.
 */
export function useIsSiteAdmin() {
  const { role } = useAuth();
  return role === 'admin';
}
