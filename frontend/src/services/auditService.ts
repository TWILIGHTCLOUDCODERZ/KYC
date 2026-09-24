import { supabase } from '../lib/supabase';
import { auth } from '../lib/firebase';
import type { AuditAction } from '../types/database';

interface LogParams {
  action: AuditAction;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}

export async function logAuditAction(params: LogParams) {
  const uid = auth.currentUser?.uid;
  await supabase.from('audit_logs').insert({
    user_id: uid,
    actor_id: uid,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    details: params.details,
  });
}
