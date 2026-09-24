import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ShieldCheck, User,
  BarChart3, UserCheck, ClipboardList, Activity, UserCog, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Customer
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard',        roles: ['customer', 'admin', 'compliance_officer', 'relationship_manager', 'kyc_officer'] },
  { label: 'My Documents',     icon: FileText,        path: '/onboarding/photo', roles: ['customer'] },
  { label: 'Profile',          icon: User,            path: '/settings',         roles: ['customer'] },
  // Admin / Officers
  { label: 'Admin Dashboard',  icon: BarChart3,       path: '/admin',            roles: ['admin', 'compliance_officer'] },
  { label: 'Review Customers', icon: UserCheck,       path: '/admin/customers',  roles: ['admin', 'compliance_officer', 'relationship_manager', 'kyc_officer'] },
  { label: 'AML Screening',    icon: AlertTriangle,   path: '/admin/aml',        roles: ['admin', 'compliance_officer'] },
  { label: 'Audit Logs',       icon: ClipboardList,   path: '/admin/audit',      roles: ['admin', 'compliance_officer', 'kyc_officer'] },
  { label: 'Reports',          icon: Activity,        path: '/admin/reports',    roles: ['admin', 'compliance_officer'] },
  { label: 'User Management',  icon: UserCog,         path: '/admin/users',      roles: ['admin'] },
];

export default function TopNav() {
  const { profile } = useAuth();
  const visibleItems = NAV_ITEMS.filter(item => profile?.role && item.roles.includes(profile.role));

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm shrink-0 z-20 overflow-x-auto">
      <div className="flex items-stretch px-4 gap-0 min-w-max">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-ntt-blue text-ntt-blue bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50'
              }`
            }
          >
            <item.icon style={{ width: 15, height: 15 }} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
