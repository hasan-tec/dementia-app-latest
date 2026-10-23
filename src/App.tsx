import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TourProvider } from './components/tour/TourProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { People } from './pages/People';
import { PersonDetail } from './pages/PersonDetail';
import { ARViewer } from './pages/ARViewer';
import { Guide } from './pages/Guide';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';
import { NotFound } from './pages/NotFound';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TourProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected AR Viewer (Full Screen Outside Layout) */}
            <Route
              path="/ar"
              element={
                <ProtectedRoute>
                  <ARViewer />
                </ProtectedRoute>
              }
            />

            {/* Protected Caregiver Portal with Sidebar Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonDetail />} />
              <Route path="/person/:id" element={<PersonDetail />} />
              <Route path="/help" element={<Guide />} />
            </Route>

            {/* 404 Not Found Page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TourProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
