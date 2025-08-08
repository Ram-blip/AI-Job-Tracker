// routes/applications.js
const express = require('express');
const authGuard = require('../middleware/authGuard');
const Application = require('../db/models/Application');

const router = express.Router();

/** Map Mongo _id -> id for client convenience */
function mapDoc(doc) {
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/** GET /applications  */
router.get('/', authGuard, async (req, res) => {
  try {
    const docs = await Application.find({ userId: req.userId })
      .sort({ dateApplied: -1 })
      .lean();
    res.json({ applications: docs.map(mapDoc) });
  } catch (e) {
    console.error('GET /applications error', e);
    res.status(500).json({ error: 'Failed to load applications' });
  }
});

/** PATCH /applications/:id  (inline edit: jobTitle, company, platform) */
router.patch('/:id', authGuard, async (req, res) => {
  const { id } = req.params;
  const { jobTitle, company, platform } = req.body || {};
  const $set = {};

  if (typeof jobTitle === 'string') $set.jobTitle = jobTitle.trim() || 'not found';
  if (typeof company === 'string') $set.company = company.trim();
  if (typeof platform === 'string') $set.platform = platform.trim() || null;

  if ('company' in $set && !$set.company) {
    return res.status(400).json({ error: 'Company cannot be empty.' });
  }

  try {
    const updated = await Application.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Application not found.' });
    res.json({ ok: true, application: mapDoc(updated) });
  } catch (e) {
    console.error('PATCH /applications/:id error', e);
    res.status(500).json({ error: 'Failed to update application.' });
  }
});

/** PATCH /applications/:id/status  (keeps your existing UI flow) */
router.patch('/:id/status', authGuard, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  try {
    const updated = await Application.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Application not found.' });
    res.json({ ok: true, application: mapDoc(updated) });
  } catch (e) {
    console.error('PATCH /applications/:id/status error', e);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

/** PATCH /applications/:id/notes  (keeps your existing UI flow) */
router.patch('/:id/notes', authGuard, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body || {};
  try {
    const updated = await Application.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: { notes } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Application not found.' });
    res.json({ ok: true, application: mapDoc(updated) });
  } catch (e) {
    console.error('PATCH /applications/:id/notes error', e);
    res.status(500).json({ error: 'Failed to update notes.' });
  }
});

module.exports = router;
