import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getToken, setToken, UNAUTHORIZED_EVENT } from './api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cats from './pages/Cats.jsx';
import CatForm from './pages/CatForm.jsx';
import Orders from './pages/Orders.jsx';

export default function App() {
  const [token, setTokenState] = useState(getToken);
  const navigate = useNavigate();

  // Any 401 from the API logs the user out and sends them to the login page.
  useEffect(() => {
    const onUnauthorized = () => {
      setTokenState(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [navigate]);

  const onLogin = (newToken) => {
    setToken(newToken);
    setTokenState(newToken);
    navigate('/', { replace: true });
  };

  const onLogout = () => {
    setToken(null);
    setTokenState(null);
    navigate('/login', { replace: true });
  };

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={onLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout onLogout={onLogout} />}>
        <Route index element={<Dashboard />} />
        <Route path="cats" element={<Cats />} />
        <Route path="cats/new" element={<CatForm />} />
        <Route path="cats/:id" element={<CatForm />} />
        <Route path="orders" element={<Orders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
