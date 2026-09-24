import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { auth } from './firebase';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  // Supabase Third-Party Auth: every request is authorized as the current
  // Firebase user by attaching their ID token. Configure Firebase as a
  // third-party auth provider in the Supabase dashboard for RLS to trust it.
  accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});
