import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon, CalendarDaysIcon, ClockIcon, UsersIcon,
  ChartBarIcon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon,
  CheckCircleIcon, DocumentPlusIcon, SunIcon, BanknotesIcon, DocumentTextIcon as PayslipIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import api from '../api/client';

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-700 text-white'
            : 'text-blue-100 hover:bg-brand-700 hover:text-white'
        }`
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get('/reports/notifications').then(r => {
      setUnread(r.data.filter((n: any) => !n.read).length);
    }).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-brand-800 flex flex-col">
        <div className="p-5 border-b border-brand-700">
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="Kinetics Group" className="h-8 object-contain brightness-0 invert" />
          </div>
          <p className="text-white font-semibold text-sm">HR Leave System</p>
          <p className="text-blue-200 text-xs mt-0.5">{user?.department}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem to="/" icon={HomeIcon} label="Dashboard" />
          <NavItem to="/leave/request" icon={DocumentPlusIcon} label="Request Leave" />
          <NavItem to="/leave/history" icon={CalendarDaysIcon} label="My Leaves" />
          <NavItem to="/personal-time" icon={ClockIcon} label="Personal Time" />
          <NavItem to="/payslip" icon={PayslipIcon} label="My Payslip" />
          <NavItem to="/calendar" icon={CalendarDaysIcon} label="Team Calendar" />

          {(user?.role === 'manager' || user?.role === 'hr_admin') && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider px-3">Management</p>
              </div>
              <NavItem to="/leave/approvals" icon={CheckCircleIcon} label="Approvals" />
              <NavItem to="/admin/reports" icon={ChartBarIcon} label="Reports" />
              {user?.role === 'hr_admin' && (
                <NavItem to="/admin/deductions" icon={BanknotesIcon} label="Deductions" />
              )}
            </>
          )}

          {user?.role === 'hr_admin' && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider px-3">Admin</p>
              </div>
              <NavItem to="/admin/employees" icon={UsersIcon} label="Employees" />
              <NavItem to="/admin/holidays" icon={SunIcon} label="Public Holidays" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-brand-700 space-y-1">
          <NavItem to="/profile" icon={UserCircleIcon} label={user?.name || 'Profile'} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-brand-700 hover:text-white transition-colors w-full text-left"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm text-gray-500">Welcome back,</p>
            <p className="font-semibold text-gray-900">{user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full font-medium capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
            <button className="relative p-2 text-gray-400 hover:text-gray-600" onClick={() => navigate('/leave/approvals')}>
              <BellIcon className="h-6 w-6" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
