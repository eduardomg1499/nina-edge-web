import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Scheduler } from './pages/Scheduler';
import { ControlRoom } from './pages/ControlRoom';
import { Users } from './pages/Users';
import { Layout } from './components/Layout';

function PrivateRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user, token } = useAuthStore();
  
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/control-room" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<PrivateRoute roles={['Administrador', 'Usuario']}><Dashboard /></PrivateRoute>} />
          <Route path="scheduler" element={<PrivateRoute roles={['Administrador', 'Usuario']}><Scheduler /></PrivateRoute>} />
          <Route path="control-room" element={<ControlRoom />} />
          <Route path="users" element={<PrivateRoute roles={['Administrador']}><Users /></PrivateRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}
