// gmail/fetch.js

/* -------------- Query Strategy --------------
We merge results from multiple targeted searches:
  A) Phrase variants (received/submitted/thank-you/apply)
  B) Subject-focused variants (ONLY with "application" terms)
  C) ATS domain sweep (explicit domains like icims.com, lever.co, etc.)

We DO NOT restrict to category:primary (ATS mail often lands in Updates/Promotions).
---------------------------------------------- */

const ATS_DOMAIN_LIST = [
  'workday.com', 'myworkday.com',
  'greenhouse.io', 'grnhse.com',
  'lever.co',
  'smartrecruiters.com',
  'icims.com', 'talent.icims.com',
  'successfactors.com', 'sap.com',
  'oraclecloud.com',
  'bamboohr.com',
  'rippling.com',
  'ashbyhq.com', 'ashby.com',
  'linkedin.com',
  'indeed.com',
  'modernhire.com'
];

const PHRASE_QUERIES = [
  '"thank you for applying"',
  '"application received"',
  '"your application has been received"',
  '"we have received your application"',
  '"we received your application"',
  '"application submitted"',
  '"has been submitted"',
  '"application confirmation"',
  '"thank you for your interest" application',
  '"we appreciate your interest" application',
  // Important for Spectrum/iCIMS style language
  '"apply to" application',
  '"your application was received"',
  '"application was received"'
].map(q => `(${q})`);

const SUBJECT_QUERIES = [
  'subject:("thank you for applying" OR "application received" OR "we received your application" OR "application submitted" OR "application confirmation")',
  'subject:(application (received OR submitted OR confirmation))',
  'subject:(acknowledgement application) OR subject:(acknowledgment application)'
];

// Build a single OR group with explicit domains
const DOMAIN_QUERIES = [
  '(' + ATS_DOMAIN_LIST.map(d => `from:${d}`).join(' OR ') + ')'
];

const GLOBAL_FILTERS = '-from:jobscan -subject:newsletter -from:newsletter';

function combine(q) {
  // Do NOT force category:primary — ATS emails may be in Updates/Promotions
  return [q, GLOBAL_FILTERS].join(' ');
}

async function listAllPages(gmail, baseQuery, max = 200) {
  let out = [];
  let nextPageToken = null;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: baseQuery,
      maxResults: Math.min(max, 100),
      pageToken: nextPageToken || undefined,
      includeSpamTrash: false
    });
    const msgs = res.data.messages || [];
    out = out.concat(msgs);
    nextPageToken = res.data.nextPageToken;
  } while (nextPageToken && out.length < max);
  return out;
}

async function listJobRelatedMessageIds(gmail) {
  const queries = []
    .concat(PHRASE_QUERIES.map(combine))
    .concat(SUBJECT_QUERIES.map(combine))
    .concat(DOMAIN_QUERIES.map(combine))
    // ATS + application token helps with generic subjects
    .concat([
      combine('((' + ATS_DOMAIN_LIST.map(d => `from:${d}`).join(' OR ') + ') (apply OR applying OR applied OR application))')
    ]);

  const seen = new Map();
  for (const q of queries) {
    try {
      const batch = await listAllPages(gmail, q, 200);
      for (const m of batch) {
        if (m?.id && !seen.has(m.id)) {
          seen.set(m.id, m);
        }
      }
    } catch (e) {
      console.log('⚠️ Query failed:', q, e.message);
    }
  }
  return Array.from(seen.values());
}

async function getMessage(gmail, id) {
  const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  return res.data;
}

/* ---------- Body extraction (robust) ---------- */

function b64urlToUtf8(data) {
  try {
    const fixed = (data || '').replace(/-/g, '+').replace(/_/g, '/');
    const buff = Buffer.from(fixed, 'base64');
    return buff.toString('utf-8');
  } catch (e) {
    return '';
  }
}

function htmlToTextSimple(html) {
  if (!html) return '';
  const decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return decoded
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function traverseParts(part, acc) {
  if (!part) return;
  const mime = part.mimeType || '';
  const data = part.body?.data ? b64urlToUtf8(part.body.data) : '';

  if (mime === 'text/plain' && data && data.trim().length > 50) {
    acc.text = acc.text || data;
  } else if (mime === 'text/html' && data && data.trim().length > 50) {
    const txt = htmlToTextSimple(data);
    if (txt && txt.length > 50 && !acc.textHtml) acc.textHtml = txt;
  }

  if (Array.isArray(part.parts)) {
    for (const p of part.parts) traverseParts(p, acc);
  }
}

function debugEmailStructure(msg) {
  try {
    console.log('🔍 === EMAIL STRUCTURE DEBUG ===');
    console.log('📧 Message ID:', msg.id);
    console.log('📧 Snippet length:', msg.snippet?.length);
    const payload = msg.payload || {};
    console.log('📧 Payload mimeType:', payload.mimeType);
    console.log('📧 Has direct body:', !!payload.body?.data);
    console.log('📧 Number of parts:', payload.parts?.length || 0);
    console.log('🔍 === END EMAIL STRUCTURE DEBUG ===\n');
  } catch {}
}

function extractPlainBody(msg) {
  console.log('🔍 Extracting body from message...');
  debugEmailStructure(msg);

  const payload = msg.payload || {};

  // 1) direct body (URL-safe base64)
  if (payload.body?.data) {
    const text = b64urlToUtf8(payload.body.data);
    if ((text || '').trim().length > 50) {
      console.log('✅ Found direct body, length:', text.length);
      return text;
    }
  }

  // 2) traverse MIME tree
  const acc = { text: '', textHtml: '' };
  traverseParts(payload, acc);
  if (acc.text) {
    console.log('✅ Found text/plain via traversal, length:', acc.text.length);
    return acc.text;
  }
  if (acc.textHtml) {
    console.log('✅ Found text/html via traversal, extracted text length:', acc.textHtml.length);
    return acc.textHtml;
  }

  // 3) snippet fallback
  console.log('📄 Falling back to snippet, length:', msg.snippet?.length || 0);
  return msg.snippet || '';
}

module.exports = { listJobRelatedMessageIds, getMessage, extractPlainBody };
