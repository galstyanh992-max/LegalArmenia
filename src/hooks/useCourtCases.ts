import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type Case = Database['public']['Tables']['cases']['Row'];

export function useCourtCases() {
  const { user, isAdmin, isAuditor, isLawyer } = useAuth();

  const { data: cases, isLoading, error } = useQuery({
    queryKey: ['court-cases', user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('cases')
        .select('*')
        .not('court_date', 'is', null)
        .is('deleted_at', null);

      // Filter based on user role
      if (isAdmin) {
        // Admin sees all cases with court dates
        // No additional filtering needed
      } else if (isAuditor) {
        // Auditor sees team's cases (all cases in their organization)
        // For now, we'll show all cases - this can be enhanced with team/org filtering
        // when that structure is available in the database
      } else if (isLawyer) {
        // Lawyer sees cases where they are the lawyer or a party
        // (the cases view exposes lawyer_id/client_id, not created_by)
        query = query.or(`lawyer_id.eq.${user.id},client_id.eq.${user.id}`);
      } else {
        // Default: only show user's own cases
        query = query.or(`lawyer_id.eq.${user.id},client_id.eq.${user.id}`);
      }

      query = query.order('court_date', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data as Case[];
    },
    enabled: !!user,
  });

  return {
    cases: cases || [],
    isLoading,
    error,
  };
}
