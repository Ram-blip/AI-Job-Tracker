// routes/gmail.js
const express = require('express');
const authGuard = require('../middleware/authGuard');
const { makeAuthedGmailClient } = require('../gmail/client');
const { listJobRelatedMessageIds, getMessage, extractPlainBody } = require('../gmail/fetch');
const Application = require('../db/models/Application');
const { extractWithGemini } = require('../ai/gemini');

const router = express.Router();

const SAFE_DEFAULT_TITLE = 'not found';

/* ----------------- Helpers ----------------- */
function truncate(str, max = 12000) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) : str;
}

/** Parse Gmail “Date” header (RFC 2822) */
function parseRfc2822Date(dateHeader) {
  if (!dateHeader) return null;
  const d = new Date(dateHeader);
  return isNaN(d.getTime()) ? null : d;
}

/** Prefer Date header → internalDate → now */
function pickReceivedDate(dateHeader, internalDateMs) {
  return (
    parseRfc2822Date(dateHeader) ||
    (internalDateMs ? new Date(Number(internalDateMs)) : null) ||
    new Date()
  );
}

/** Simple filter to avoid obvious non-job emails */
function isLikelyJobApplicationEmail(subject = '', from = '', body = '') {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  const b = (body || '').toLowerCase().slice(0, 8000);

  const NEG = [
    'order confirmation','your order','order number','thanks for your purchase','purchase confirmation',
    'invoice','receipt','payment','billing','refund','shipping','delivery','tracking',
    'account confirmation','customer account','verify your email','verification code','password reset',
    'security alert','free trial','newsletter','subscription','sale','discount','promo'
  ];

  const POS = [
    'thank you for applying','we received your application','we have received your application',
    'your application has been received','application received','application submitted',
    'candidate portal','requisition','career site','hiring team','recruiting team',
    'apply to','applied to','application was received'
  ];

  const ROOT = /\b(apply|applying|applied|application|applications|candidate|position|role)\b/;

  const hasNegative = NEG.some(p => s.includes(p) || b.includes(p));
  const hardAllow = /\bthank\s+you\s+for\s+applying\b/i.test(s); // e.g. “Thank You for Applying to Spectrum”
  if (!hardAllow && hasNegative) return false;

  const isAtsDomain = /(workday|myworkday|greenhouse|grnhse|lever|smartrecruiters|icims|successfactors|oraclecloud|bamboohr|rippling|ashby|linkedin|indeed|modernhire)/i
    .test(f);

  const hasPositivePhrase = POS.some(p => s.includes(p) || b.includes(p));
  const hasRootToken = ROOT.test(s) || ROOT.test(b);

  if (isAtsDomain) return hasPositivePhrase || hasRootToken || hardAllow;
  return hasPositivePhrase || hasRootToken || hardAllow;
}

/* ----------------- Route ----------------- */
router.post('/fetch', authGuard, async (req, res) => {
  console.log('🔍 Starting Gmail fetch for user:', req.userId);

  try {
    const userId = req.userId;
    const gmail = await makeAuthedGmailClient(userId);
    console.log('✅ Gmail client created successfully');

    const messages = await listJobRelatedMessageIds(gmail);
    console.log('📧 Messages found:', messages?.length || 0);

    let created = 0, skipped = 0, errors = 0;

    for (const m of messages || []) {
      if (!m.id) continue;

      const exists = await Application.findOne({ messageId: m.id }).lean();
      if (exists) { skipped++; continue; }

      try {
        const full = await getMessage(gmail, m.id);

        const headers = full.payload?.headers || [];
        const H = (name) => headers.find(h => (h.name || '').toLowerCase() === name)?.value || '';
        const subject = H('subject');
        const from = H('from');
        const dateHeader = H('date');
        const internalDateMs = full.internalDate ? Number(full.internalDate) : null;

        const body = extractPlainBody(full);

        // Avoid obvious noise before calling the model
        if (!isLikelyJobApplicationEmail(subject, from, body)) { skipped++; continue; }

        const emailContent = `Subject: ${subject}\nFrom: ${from}\nDate: ${dateHeader}\n\n${truncate(body)}`;
        const extracted = await extractWithGemini(emailContent, { subject, from, date: dateHeader });

        if (!extracted || !extracted.company) { skipped++; continue; }

        // Role optional; if missing, we store "not found"
        const jobTitleFinal = extracted.jobTitle?.trim() || SAFE_DEFAULT_TITLE;

        // 👉 Applied = when Gmail received the email
        const receivedAt = pickReceivedDate(dateHeader, internalDateMs);

        await Application.create({
          userId,
          messageId: full.id,
          threadId: full.threadId || null,
          jobTitle: jobTitleFinal,
          company: extracted.company.trim(),
          platform: extracted.platform || null,
          dateApplied: receivedAt,                 // IMPORTANT: store Gmail receive time (Date)
          subject: subject || null,                // optional: useful to display/debug
          fromAddress: from || null,               // optional
          rawSnippet: body?.slice(0, 800) || null  // optional
        });

        created++;
      } catch (error) {
        console.error('❌ Error processing message:', m.id, error.message);
        errors++;
      }
    }

    res.json({ ok: true, created, skipped, errors, totalSeen: messages?.length || 0 });
  } catch (error) {
    console.error('💥 Gmail fetch failed:', error);
    res.status(500).json({ error: 'Gmail fetch failed', details: error.message });
  }
});

module.exports = router;
