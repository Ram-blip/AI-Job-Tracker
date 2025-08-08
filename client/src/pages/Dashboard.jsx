// Dashboard.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import ApplicationsTable from '../components/ApplicationsTable';
import UserProfile from '../components/UserProfile';
import './Dashboard.css';

export default function Dashboard({ user }) {
  const [apps, setApps] = useState([]);
  const [fetching, setFetching] = useState(false);

  const load = async () => {
    const r = await api.get('/applications');
    setApps(r.data.applications);
  };
  useEffect(() => { load(); }, []);

  const fetchEmails = async () => {
    setFetching(true);
    try {
      await api.post('/gmail/fetch');
      await load();
    } finally { setFetching(false); }
  };

  const onStatusChange = async (id, status) => {
    await api.patch(`/applications/${id}/status`, { status });
    await load();
  };

  const onNotesChange = async (id, notes) => {
    try {
      await api.patch(`/applications/${id}/notes`, { notes });
      setApps(prevApps =>
        prevApps.map(app => (app.id === id ? { ...app, notes } : app))
      );
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  // NEW: generic row updater for inline edits (jobTitle/company/platform)
  const onEditRow = async (id, patch) => {
    await api.patch(`/applications/${id}`, patch);
    await load();
  };

  const stats = {
    total: apps.length,
    applied: apps.filter(app => app.status === 'APPLIED').length,
    assessment: apps.filter(app => app.status === 'ASSESSMENT').length,
    interview: apps.filter(app => app.status === 'INTERVIEW').length,
    offer: apps.filter(app => app.status === 'OFFER').length,
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="dashboard-brand">
          <div className="brand-text">
            <strong>AI Job Tracker</strong>
          </div>
        </div>
        <UserProfile user={user} />
      </nav>

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Welcome back, {user.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="dashboard-subtitle">
            Track your job applications and stay organized.
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-number">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-number">{stats.applied}</div>
              <div className="stat-label">Applied</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-number">{stats.interview}</div>
              <div className="stat-label">Interviews</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-number">{stats.offer}</div>
              <div className="stat-label">Offers</div>
            </div>
          </div>
        </div>

        <div className="action-bar">
          <h2 className="action-title">Your Applications</h2>
          <button
            className={`fetch-button ${fetching ? 'loading' : ''}`}
            onClick={fetchEmails}
            disabled={fetching}
          >
            {fetching ? 'Syncing...' : 'Sync Emails'}
          </button>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Application History</h3>
          </div>
          <div className="table-content">
            <ApplicationsTable
              applications={apps}
              onStatusChange={onStatusChange}
              onNotesChange={onNotesChange}
              onEditRow={onEditRow}          // <-- pass it down
            />
          </div>
        </div>
      </div>
    </div>
  );
}
