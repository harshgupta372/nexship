import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Login            from './pages/Login';
import Register         from './pages/Register';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import PlaceOrder       from './pages/customer/PlaceOrder';
import TrackOrder       from './pages/customer/TrackOrder';
import AgentDashboard   from './pages/agent/AgentDashboard';
import AdminDashboard   from './pages/admin/AdminDashboard';
import Analytics        from './pages/admin/Analytics';

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Navigate to="/login" replace />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/unauthorized" element={<div className="p-8 text-center text-gray-500">Access denied.</div>} />

        {/* Customer */}
        <Route path="/customer" element={<ProtectedRoute role="CUSTOMER"><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/customer/place-order" element={<ProtectedRoute role="CUSTOMER"><PlaceOrder /></ProtectedRoute>} />
        <Route path="/customer/track/:orderId" element={<ProtectedRoute role="CUSTOMER"><TrackOrder /></ProtectedRoute>} />

        {/* Agent */}
        <Route path="/agent" element={<ProtectedRoute role="AGENT"><AgentDashboard /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin"            element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/analytics"  element={<ProtectedRoute role="ADMIN"><Analytics /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
