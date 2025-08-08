import { useEffect, useState } from 'react';
import { api } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
       .then(r => setUser(r.data.user))
       .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center">Loading…</div>;
  return user ? <Dashboard user={user} /> : <Login />;
}
