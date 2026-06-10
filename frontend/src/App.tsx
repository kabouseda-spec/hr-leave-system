import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeaveRequest from './pages/LeaveRequest';
import LeaveHistory from './pages/LeaveHistory';
import Approvals from './pages/Approvals';
import TeamCalendar from './pages/TeamCalendar';
import AdminEmployees from './pages/AdminEmployees';
import AdminReports from './pages/AdminReports';
import AdminHolidays from './pages/AdminHolidays';
import AdminDeductions from './pages/AdminDeductions';
import PaySlip from './pages/PaySlip';
import PersonalTime from './pages/PersonalTime';
import Profile from './pages/Profile';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="leave/request" element={<LeaveRequest />} />
        <Route path="leave/history" element={<LeaveHistory />} />
        <Route path="leave/approvals" element={<ProtectedRoute roles={['manager','hr_admin']}><Approvals /></ProtectedRoute>} />
        <Route path="calendar" element={<TeamCalendar />} />
        <Route path="personal-time" element={<PersonalTime />} />
        <Route path="payslip" element={<PaySlip />} />
        <Route path="admin/employees" element={<ProtectedRoute roles={['hr_admin']}><AdminEmployees /></ProtectedRoute>} />
        <Route path="admin/holidays" element={<ProtectedRoute roles={['hr_admin']}><AdminHolidays /></ProtectedRoute>} />
        <Route path="admin/deductions" element={<ProtectedRoute roles={['hr_admin']}><AdminDeductions /></ProtectedRoute>} />
        <Route path="admin/reports" element={<ProtectedRoute roles={['hr_admin','manager']}><AdminReports /></ProtectedRoute>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
