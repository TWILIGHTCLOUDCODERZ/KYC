import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import NTTLogo from '../../components/common/NTTLogo';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminRole } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } else {
      // profile may not be loaded yet; fetch fresh role from supabase directly
      const uid = auth.currentUser?.uid;
      if (uid) {
        const { data: p } = await supabase.from('profiles').select('role').eq('user_id', uid).maybeSingle();
        if (p && isAdminRole(p.role)) {
          navigate('/admin');
          return;
        }
      }
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 bg-ntt-blue relative overflow-hidden flex-col justify-between p-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full bg-primary-500/20" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-ntt-red/20" />
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px)',
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <NTTLogo size={48} />
            <div>
              <p className="text-xl font-bold text-white">NTT DATA</p>
              <p className="text-sm text-blue-300">Bank KYC Platform</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Enterprise-Grade<br />KYC Onboarding
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10">
            Streamline customer verification with AI-powered document processing, fraud detection, and AML compliance.
          </p>

          <div className="space-y-4">
            {[
              { icon: '🔒', title: 'Bank-grade Security', desc: 'End-to-end encryption & multi-factor auth' },
              { icon: '🤖', title: 'AI-Powered OCR', desc: 'Automated document extraction & validation' },
              { icon: '⚡', title: 'Real-time AML Screening', desc: 'Instant risk scoring & watchlist checks' },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-blue-200 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-xs text-blue-300">
          <span>ISO 27001 Certified</span>
          <span>•</span>
          <span>GDPR Compliant</span>
          <span>•</span>
          <span>PCI-DSS Level 1</span>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 lg:max-w-md flex flex-col justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <NTTLogo size={40} />
            <div>
              <p className="text-lg font-bold text-ntt-blue">NTT DATA</p>
              <p className="text-xs text-gray-500">Bank KYC Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-error-50 border border-red-200 text-error-700 px-4 py-3 rounded-lg text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <button type="button" className="text-xs text-primary-600 hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="rounded border-gray-300 text-primary-600" />
              <label htmlFor="remember" className="text-sm text-gray-600">Remember me for 30 days</label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <LoadingSpinner size="sm" color="text-white" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Create account
            </Link>
          </p>

          {/* AI badge */}
          <div className="mt-8 p-4 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl border border-sky-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                  <path d="M12 2L8.5 8.5H2L7 13l-2 7 7-4.5L19 20l-2-7 5-4.5h-6.5L12 2z" fill="#4285F4" />
                </svg>
              </div>
              <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Powered by Google AI</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <p className="text-xs text-sky-700 font-medium">Gemini AI — intelligent document analysis & extraction</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                <p className="text-xs text-sky-700 font-medium">Vision AI — real-time OCR & fraud detection in action</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
