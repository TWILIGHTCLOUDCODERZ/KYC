import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { logAuditAction } from '../services/auditService';

export interface SignUpFields {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AppUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fields: SignUpFields) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(fbUser: FirebaseUser | null): AppUser | null {
  return fbUser ? { id: fbUser.uid, email: fbUser.email } : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setProfile(data);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(toAppUser(fbUser));
      if (fbUser) {
        await fetchProfile(fbUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Stamp last_login_at — fire and forget, don't block login
      supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', cred.user.uid)
        .then(() => {});
      await logAuditAction({ action: 'login', details: { email } });
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fields: SignUpFields) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Use upsert so a duplicate call (e.g. hot-reload) doesn't error
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id:       cred.user.uid,
        full_name:     fields.fullName.trim(),
        email,
        phone:         fields.phone.trim()         || null,
        date_of_birth: fields.dateOfBirth.trim()   || null,
        nationality:   fields.nationality.trim()   || null,
        address_line1: fields.addressLine1.trim()  || null,
        address_line2: fields.addressLine2.trim()  || null,
        city:          fields.city.trim()          || null,
        state:         fields.state.trim()         || null,
        postal_code:   fields.postalCode.trim()    || null,
        country:       fields.country.trim()       || null,
        role:           'customer',
        kyc_status:     'in_progress',
        risk_level:     'low',
        aml_score:      0,
        face_verified:  false,
        is_active:      true,
        account_status: 'active',
        approval_level: 0,
      }, { onConflict: 'user_id' });
      if (profileError) return { error: profileError as Error };
      await fetchProfile(cred.user.uid);
      logAuditAction({ action: 'register', details: { email } });
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await logAuditAction({ action: 'logout' });
    await firebaseSignOut(auth);
  };

  const refreshProfile = useCallback(async () => {
    const uid = auth.currentUser?.uid ?? user?.id;
    if (uid) await fetchProfile(uid);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
