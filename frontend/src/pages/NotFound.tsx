import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import NTTLogo from '../components/common/NTTLogo';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ntt-lightgray p-6">
      <NTTLogo size={48} className="mb-6" />
      <h1 className="text-7xl font-bold text-ntt-blue mb-2">404</h1>
      <p className="text-xl font-semibold text-gray-700 mb-2">Page Not Found</p>
      <p className="text-gray-400 text-sm mb-8 text-center max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          <Home className="w-4 h-4" /> Dashboard
        </button>
      </div>
    </div>
  );
}
