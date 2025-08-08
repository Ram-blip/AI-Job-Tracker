import { useState, useEffect } from 'react';
import './ApplicationsTable.css';

const statuses = ['APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED'];

/**
 * Returns a date-only string in America/Los_Angeles with this logic:
 * - If diff < 24h AND message day == today (in LA)  -> show today's date
 * - Else                                            -> show the message's date
 * Format: YYYY-MM-DD
 */
function formatAppliedDateOnly(input, { tz = 'America/Los_Angeles', now = new Date() } = {}) {
  const msgDate = input instanceof Date ? input : new Date(input);
  if (isNaN(msgDate.getTime())) return '';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const diffMs = now.getTime() - msgDate.getTime();

  const getYMD = (d) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return { y: map.year, m: map.month, d: map.day, ymd: `${map.month}-${map.day}-${map.year}` };
  };

  const msg = getYMD(msgDate);
  const curr = getYMD(now);

  // Only coerce to "today" when it's the same LA calendar day AND <24h
  const useToday = (diffMs < DAY_MS) && (msg.y === curr.y && msg.m === curr.m && msg.d === curr.d);

  return useToday ? curr.ymd : msg.ymd;
}

export default function ApplicationsTable({
  applications,
  onStatusChange,
  onNotesChange,
  onEditRow, // pass from Dashboard
}) {
  // Local state for notes to make typing fast (debounced save)
  const [localNotes, setLocalNotes] = useState({});
  const [saveTimeouts, setSaveTimeouts] = useState({});

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ jobTitle: '', company: '', platform: '' });
  const [saving, setSaving] = useState(false);

  // Initialize local notes when applications change
  useEffect(() => {
    const notesMap = {};
    (applications || []).forEach(app => {
      const id = app.id || app._id; // be robust to either shape
      notesMap[id] = app.notes || '';
    });
    setLocalNotes(notesMap);
  }, [applications]);

  const handleNotesChange = (id, notes) => {
    setLocalNotes(prev => ({ ...prev, [id]: notes }));
    if (saveTimeouts[id]) clearTimeout(saveTimeouts[id]);
    const timeoutId = setTimeout(() => {
      onNotesChange(id, notes);
      setSaveTimeouts(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 1000);
    setSaveTimeouts(prev => ({ ...prev, [id]: timeoutId }));
  };

  const getStatusClass = (status) => `status-${status.toLowerCase()}`;

  const startEdit = (app) => {
    const id = app.id || app._id;
    setEditingId(id);
    setForm({
      jobTitle: app.jobTitle || '',
      company: app.company || '',
      platform: app.platform || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ jobTitle: '', company: '', platform: '' });
  };

  const saveEdit = async (id) => {
    const patch = {
      jobTitle: (form.jobTitle || '').trim(),
      company: (form.company || '').trim(),
      platform: (form.platform || '').trim()
    };
    if (!patch.company) {
      alert('Company cannot be empty.');
      return;
    }
    if (!patch.jobTitle) patch.jobTitle = 'not found';

    setSaving(true);
    try {
      await onEditRow(id, patch);
      cancelEdit();
    } catch (e) {
      console.error('Save edit failed', e);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <table className="applications-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Job Title</th>
          <th>Company</th>
          <th>Platform</th>
          <th>Applied</th>
          <th>Status</th>
          <th>Notes</th>
          <th style={{ width: 160 }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {(applications || []).map((a, index) => {
          const id = a.id || a._id;
          const isEditing = editingId === id;
          return (
            <tr key={id}>
              <td className="app-number">#{index + 1}</td>

              {/* Job Title */}
              <td className="job-title">
                {isEditing ? (
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="e.g., Software Engineer"
                  />
                ) : (
                  a.jobTitle || <span className="muted">not found</span>
                )}
              </td>

              {/* Company */}
              <td className="company">
                {isEditing ? (
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="Company"
                  />
                ) : (
                  a.company || <span className="muted">—</span>
                )}
              </td>

              {/* Platform */}
              <td className="platform">
                {isEditing ? (
                  <input
                    type="text"
                    value={form.platform}
                    onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
                    placeholder="Workday / Lever / …"
                  />
                ) : (
                  a.platform || <span className="muted">-</span>
                )}
              </td>

              {/* Applied (date-only with LA-day correction) */}
              <td className="date-applied">
                {formatAppliedDateOnly(a.dateApplied)}
              </td>

              {/* Status */}
              <td>
                <select
                  value={a.status}
                  onChange={e => onStatusChange(id, e.target.value)}
                  className={`status-select ${getStatusClass(a.status)}`}
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>

              {/* Notes */}
              <td>
                <textarea
                  value={localNotes[id] || ''}
                  onChange={e => handleNotesChange(id, e.target.value)}
                  placeholder="Add notes..."
                  className="notes-textarea"
                  rows={2}
                />
              </td>

              {/* Actions */}
              <td className="actions-cell">
                {!isEditing ? (
                  <button
                    className="btn btn-outline"
                    onClick={() => startEdit(a)}
                    title="Edit row"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={() => saveEdit(id)}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={cancelEdit}
                      disabled={saving}
                      style={{ marginLeft: 8 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}

        {!(applications || []).length && (
          <tr>
            <td colSpan="8" className="empty-state">
              <div className="empty-state-text">No applications yet</div>
              <div className="empty-state-subtitle">
                Click "Fetch Emails" to get started
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
