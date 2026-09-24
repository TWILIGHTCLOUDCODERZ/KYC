import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { KYCDocument } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

export function useDocuments(targetUserId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    const id = targetUserId || user?.id;
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    setDocuments(data ?? []);
    setLoading(false);
  }, [user?.id, targetUserId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  return { documents, loading, refetch: fetchDocuments };
}
