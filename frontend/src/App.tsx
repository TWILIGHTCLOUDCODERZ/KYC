import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CustomerDashboard from './pages/customer/Dashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import ReviewCustomers from './pages/admin/ReviewCustomers';
import CustomerDetail from './pages/admin/CustomerDetail';
import AuditLogs from './pages/admin/AuditLogs';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Onboarding step pages
import VerifyAccount   from './pages/onboarding/VerifyAccount';
import PhotoUpload     from './pages/onboarding/PhotoUpload';
import PassportUpload  from './pages/onboarding/PassportUpload';
import LiveFaceUpload  from './pages/onboarding/LiveFaceUpload';
import AddressUpload   from './pages/onboarding/AddressUpload';
import TaxUpload       from './pages/onboarding/TaxUpload';
import SalaryUpload    from './pages/onboarding/SalaryUpload';

const CUSTOMER   = ['customer'] as const;
const ADMIN_ROLES = ['admin', 'compliance_officer', 'kyc_officer'] as const;
const REVIEW_ROLES = ['admin', 'compliance_officer', 'relationship_manager', 'kyc_officer'] as const;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer — general */}
          <Route path="/dashboard" element={
            <ProtectedRoute><CustomerDashboard /></ProtectedRoute>
          } />
          {/* Customer — KYC onboarding steps */}
          <Route path="/onboarding/verify-account" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><VerifyAccount /></ProtectedRoute>
          } />
          <Route path="/onboarding/photo" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><PhotoUpload /></ProtectedRoute>
          } />
          <Route path="/onboarding/passport" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><PassportUpload /></ProtectedRoute>
          } />
          <Route path="/onboarding/live-face" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><LiveFaceUpload /></ProtectedRoute>
          } />
          <Route path="/onboarding/address" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><AddressUpload /></ProtectedRoute>
          } />
          <Route path="/onboarding/tax" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><TaxUpload /></ProtectedRoute>
          } />
          <Route path="/onboarding/salary" element={
            <ProtectedRoute allowedRoles={[...CUSTOMER]}><SalaryUpload /></ProtectedRoute>
          } />

          {/* Shared */}
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />

          {/* Admin / KYC Officer */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
            <ProtectedRoute allowedRoles={[...REVIEW_ROLES]}><ReviewCustomers /></ProtectedRoute>
          } />
          <Route path="/admin/customers/:userId" element={
            <ProtectedRoute allowedRoles={[...REVIEW_ROLES]}><CustomerDetail /></ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}><AuditLogs /></ProtectedRoute>
          } />
          <Route path="/admin/aml" element={
            <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}><ReviewCustomers /></ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}><AdminDashboard /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
