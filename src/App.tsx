import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import TwoFactorChallengePage from './pages/TwoFactorChallengePage';
import SuperAdminLogin from './pages/SuperAdminLogin';
import JobsPage from './pages/JobsPage';
import WorkersPage from './pages/WorkersPage';
import ProfilePage from './pages/ProfilePage';
import MyProfilePage from './pages/MyProfilePage';
import ChatPage from './pages/ChatPage';
import StatisticsPage from './pages/StatisticsPage';
import CoursesPage from './pages/CoursesPage';
import EmployerDashboard from './pages/employer/Dashboard';
import WorkerServices from './pages/employer/WorkerServices';
import WorkerDashboard from './pages/worker/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import AdminContracts from './pages/admin/Contracts';
import AdminApplications from './pages/admin/Applications';
import ResumeView from './components/ResumeView';
import AdminDisputes from './pages/admin/Disputes';
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import SuperAdminAnalytics from './pages/super-admin/Analytics';
import SuperAdminSystem from './pages/super-admin/System';
import SuperAdminSettingsPage from './pages/super-admin/SettingsPage';
import SuperAdminLogsPage from './pages/super-admin/LogsPage';
import SuperAdminContractsPage from './pages/super-admin/ContractsPage';
import SystemLogs from './pages/admin/SystemLogs';
import SystemSettings from './pages/admin/SystemSettings';
import UsersManagement from './pages/admin/UsersManagement';
import JobsManagement from './pages/admin/JobsManagement';
import VerificationManagement from './pages/admin/VerificationManagement';
import CreateJob from './pages/employer/CreateJob';
import CreateServicePost from './pages/worker/CreateServicePost';
import MyServicePosts from './pages/worker/MyServicePosts';
import ContractPage from './pages/ContractPage';
import VerificationPage from './pages/VerificationPage';
import NotificationsPage from './pages/NotificationsPage';
import ForbiddenPage from './pages/ForbiddenPage';
import EmployerApplications from './pages/employer/Applications';
import EmployerJobDetails from './pages/employer/JobDetails';
import CreateContract from './pages/employer/CreateContract';
import WorkerApplications from './pages/worker/Applications';
import WorkerContracts from './pages/worker/Contracts';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ChatAssistant from './components/ChatAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import QualayIshPage from './pages/QualayIshPage';
import SavedJobsPage from './pages/SavedJobsPage';
import QualayIshJobDetailsPage from './pages/QualayIshJobDetailsPage';

// Normalize /contracts/contracts/:id → /contracts/:id
function ContractsRedirect() {
  const { contractId } = useParams<{ contractId: string }>();
  return <Navigate to={`/contracts/${contractId}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ErrorBoundary>
            <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/2fa" element={<TwoFactorChallengePage />} />
                <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
                <Route path="/super-admin-login" element={<SuperAdminLogin />} />
                <Route path="/403" element={<ForbiddenPage />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/workers" element={<WorkersPage />} />
                <Route path="/worker/:userId" element={<ProfilePage />} />
                <Route path="/statistics" element={<StatisticsPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                
                {/* Qulay Ish Module */}
                <Route path="/qulay-ish" element={<QualayIshPage />} />
                <Route path="/qulay-ish/job/:jobId" element={<QualayIshJobDetailsPage />} />
                <Route path="/saved-jobs" element={<SavedJobsPage />} />
                
                {/* Protected Routes */}
                <Route path="/my-profile" element={<ProtectedRoute><MyProfilePage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/contracts/:contractId" element={<ProtectedRoute><ContractPage /></ProtectedRoute>} />
        {/* Normalize double-path: /contracts/contracts/:id → /contracts/:id */}
        <Route path="/contracts/contracts/:contractId" element={<ContractsRedirect />} />
        <Route path="/verification" element={<ProtectedRoute><VerificationPage /></ProtectedRoute>} />

        {/* Worker Routes */}
        <Route path="/worker/dashboard" element={<RoleProtectedRoute allowedRoles={['worker']}><WorkerDashboard /></RoleProtectedRoute>} />
        <Route path="/worker/applications" element={<RoleProtectedRoute allowedRoles={['worker']}><WorkerApplications /></RoleProtectedRoute>} />
        <Route path="/worker/contracts" element={<RoleProtectedRoute allowedRoles={['worker']}><WorkerContracts /></RoleProtectedRoute>} />
        <Route path="/worker/service-posts" element={<RoleProtectedRoute allowedRoles={['worker']}><MyServicePosts /></RoleProtectedRoute>} />
        <Route path="/worker/create-service" element={<RoleProtectedRoute allowedRoles={['worker']}><CreateServicePost /></RoleProtectedRoute>} />
        <Route path="/worker/edit-service/:postId" element={<RoleProtectedRoute allowedRoles={['worker']}><CreateServicePost /></RoleProtectedRoute>} />
        
        {/* Employer Routes */}
        <Route path="/employer/dashboard" element={<RoleProtectedRoute allowedRoles={['employer']}><EmployerDashboard /></RoleProtectedRoute>} />
        <Route path="/employer/jobs" element={<RoleProtectedRoute allowedRoles={['employer']}><EmployerDashboard /></RoleProtectedRoute>} />
        <Route path="/employer/applicants" element={<RoleProtectedRoute allowedRoles={['employer']}><EmployerApplications /></RoleProtectedRoute>} />
        <Route path="/employer/contracts" element={<RoleProtectedRoute allowedRoles={['employer']}><EmployerApplications /></RoleProtectedRoute>} />
        <Route path="/employer/create-contract" element={<RoleProtectedRoute allowedRoles={['employer']}><CreateContract /></RoleProtectedRoute>} />
        <Route path="/employer/jobs/:jobId" element={<RoleProtectedRoute allowedRoles={['employer']}><EmployerJobDetails /></RoleProtectedRoute>} />
        <Route path="/employer/create-job" element={<RoleProtectedRoute allowedRoles={['employer']}><CreateJob /></RoleProtectedRoute>} />
        <Route path="/employer/worker-services" element={<RoleProtectedRoute allowedRoles={['employer']}><WorkerServices /></RoleProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></RoleProtectedRoute>} />
        <Route path="/admin/users" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><UsersManagement /></RoleProtectedRoute>} />
        <Route path="/admin/jobs" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><JobsManagement /></RoleProtectedRoute>} />
        <Route path="/admin/contracts" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminContracts /></RoleProtectedRoute>} />
        <Route path="/admin/disputes" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDisputes /></RoleProtectedRoute>} />
        <Route path="/admin/verification" element={<RoleProtectedRoute allowedRoles={['admin', 'super_admin']}><VerificationManagement /></RoleProtectedRoute>} />

        {/* Super Admin Routes */}
        <Route path="/super-admin/dashboard" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></RoleProtectedRoute>} />
        <Route path="/super-admin/users" element={<RoleProtectedRoute allowedRoles={['super_admin']}><UsersManagement /></RoleProtectedRoute>} />
        <Route path="/super-admin/jobs" element={<RoleProtectedRoute allowedRoles={['super_admin']}><JobsManagement /></RoleProtectedRoute>} />
        <Route path="/super-admin/verification" element={<RoleProtectedRoute allowedRoles={['super_admin']}><VerificationManagement /></RoleProtectedRoute>} />
        <Route path="/super-admin/disputes" element={<RoleProtectedRoute allowedRoles={['super_admin']}><AdminDisputes /></RoleProtectedRoute>} />
        <Route path="/super-admin/contracts" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminContractsPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/contracts/:contractId" element={<RoleProtectedRoute allowedRoles={['super_admin']}><ContractPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/logs" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminLogsPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/settings" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminSettingsPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/messages" element={<RoleProtectedRoute allowedRoles={['super_admin']}><ChatPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/notifications" element={<RoleProtectedRoute allowedRoles={['super_admin']}><NotificationsPage /></RoleProtectedRoute>} />
        <Route path="/super-admin/analytics" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminAnalytics /></RoleProtectedRoute>} />
        <Route path="/super-admin/system" element={<RoleProtectedRoute allowedRoles={['super_admin']}><SuperAdminSystem /></RoleProtectedRoute>} />
        <Route path="/super-admin/revenue" element={<Navigate to="/super-admin/analytics" replace />} />
        <Route path="/super-admin/service-posts" element={<Navigate to="/super-admin/jobs" replace />} />
               <Route path="/super-admin/applications" element={<RoleProtectedRoute allowedRoles={['super_admin']}><AdminApplications /></RoleProtectedRoute>} />
               <Route path="/resume/:userId" element={<ProtectedRoute><ResumeView /></ProtectedRoute>} />
        <Route path="/super-admin/*" element={<Navigate to="/super-admin/dashboard" replace />} />
        {/* Legacy admin routes still accessible for admin role */}
        <Route path="/admin/logs" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin']}><SystemLogs /></RoleProtectedRoute>} />
        <Route path="/admin/settings" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin']}><SystemSettings /></RoleProtectedRoute>} />
        <Route path="/admin/contracts/:contractId" element={<RoleProtectedRoute allowedRoles={['super_admin', 'admin']}><ContractPage /></RoleProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              <ChatAssistant />
            </div>
          </ErrorBoundary>
        </AuthProvider>
      </Router>
</ThemeProvider>
  );
}
