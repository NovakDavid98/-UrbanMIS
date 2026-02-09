import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import { useEffect, useState } from 'react';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import VisitLog from './pages/VisitLog';
import Workers from './pages/Workers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Upload from './pages/Upload';
import WeeklyPlanner from './pages/WeeklyPlanner';
import ClientMap from './pages/ClientMap';
import DataRepair from './pages/DataRepair';

function App() {
  const { isAuthenticated, fetchUser } = useAuthStore();
  const [setupCheck, setSetupCheck] = useState({ checked: false, complete: true });

  useEffect(() => {
    // Check if setup is complete
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        setSetupCheck({ checked: true, complete: data.setupComplete });
      })
      .catch(() => {
        setSetupCheck({ checked: true, complete: false });
      });

    if (isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, fetchUser]);

  if (!setupCheck.checked) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <Router>
        <Routes>
          {/* Setup route */}
          <Route
            path="/setup"
            element={!setupCheck.complete ? <SetupWizard /> : <Navigate to="/login" replace />}
          />

          {/* Public routes */}
          <Route
            path="/login"
            element={
              !setupCheck.complete ? <Navigate to="/setup" replace /> :
                !isAuthenticated ? <Login /> : <Navigate to="/" replace />
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              !setupCheck.complete ? <Navigate to="/setup" replace /> :
                isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="visits" element={<VisitLog />} />
            <Route path="workers" element={<Workers />} />
            <Route path="planner" element={<WeeklyPlanner />} />
            <Route path="reports" element={<Reports />} />
            <Route path="map" element={<ClientMap />} />
            <Route path="data-repair" element={<DataRepair />} />
            <Route path="upload" element={<Upload />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        }}
      />
    </>
  );
}

export default App;


























