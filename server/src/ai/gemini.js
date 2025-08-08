// ai/gemini.js
const axios = require('axios');
const { z }  = require('zod');
const { GEMINI_API_KEY } = require('../env');

/* ───────── schema ───────── */
const ExtractedSchema = z.object({
  jobTitle:    z.string().nullable(),
  company:     z.string().nullable(),
  platform:    z.string().nullable().optional(),
  dateApplied: z.string().nullable()     // YYYY-MM-DD
});

/* ───────── utilities ───────── */
function strip(text) {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\n+/g, '\n');
}

function secondLevelDomainCompany(domain) {
  if (!domain) return null;
  const low = domain.toLowerCase();
  const m =
    low.match(/([a-z0-9-]+)\.(?:co\.uk|com|io|ai|app|co|net|org|cloud|dev|jobs|work)$/i) ||
    low.match(/([a-z0-9-]+)\.[a-z.]+$/i);
  if (!m) return null;
  const brand = m[1].replace(/-/g, ' ');
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function extractEmailAndDisplay(fromHeader = '') {
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : null;
  const display = fromHeader.replace(/<[^>]+>/, '').trim();
  return { email, display };
}

function normalizeCompanyFromDisplay(display) {
  if (!display) return null;
  const cleaned = display
    .replace(/\b(Recruiting|Recruitment|Talent|Careers|Hiring|HR|People|Team|No.?reply|Noreply)\b/gi, '')
    .replace(/\b(Inc\.?|LLC|Ltd\.?|Group|Corp\.?|Co\.?)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || null;
}

function cleanCompanyName(name) {
  if (!name) return null;
  let n = name
    .replace(/\b(Recruiting|Recruitment|Talent|Careers|Hiring|HR|People|Team)\b/gi, '')
    .replace(/\b(Inc\.?|LLC|Ltd\.?|Group|Corp\.?|Co\.?)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  n = n.replace(/[|•\-–—,:.\s]+$/g, '').trim();
  if (n && n === n.toLowerCase()) n = n.charAt(0).toUpperCase() + n.slice(1);
  return n || null;
}

function extractCompanyFromFromHeader(fromHeader = '') {
  const { email, display } = extractEmailAndDisplay(fromHeader);
  const displayCompany = cleanCompanyName(normalizeCompanyFromDisplay(display));
  if (displayCompany) return displayCompany;

  if (email) {
    const domain = email.split('@')[1] || '';
    const brand = secondLevelDomainCompany(domain);
    if (brand) return cleanCompanyName(brand);
  }
  return null;
}

function safePlatformFromFromOrDomain(fromHeader = '') {
  const { email } = extractEmailAndDisplay(fromHeader);
  const domain = (email && email.split('@')[1]) || (fromHeader.match(/@([^\s>]+)/)?.[1]) || '';
  const low = (domain || fromHeader || '').toLowerCase();
  if (low.includes('workday') || low.includes('myworkday')) return 'Workday';
  if (low.includes('greenhouse') || low.includes('grnhse')) return 'Greenhouse';
  if (low.includes('lever')) return 'Lever';
  if (low.includes('smartrecruiters')) return 'SmartRecruiters';
  if (low.includes('icims')) return 'iCIMS';
  if (low.includes('successfactors') || low.includes('sap')) return 'SAP SuccessFactors';
  if (low.includes('oraclecloud')) return 'Oracle Recruiting Cloud';
  if (low.includes('bamboo')) return 'BambooHR';
  if (low.includes('rippling')) return 'Rippling';
  if (low.includes('ashby')) return 'Ashby';
  if (low.includes('linkedin')) return 'LinkedIn';
  if (low.includes('indeed')) return 'Indeed';
  return null;
}

function extractFromSubject(subject = '') {
  if (!subject) return null;
  const s = subject.trim();

  const patterns = [
    /application\s+for\s+job\s+(.+?)(?:$|[–\-|#:]|req|id)/i,
    /application\s+for\s+(?:the\s+)?(.+?)(?:\s+(?:role|position)|$|[–\-|#:])/i,
    /for\s+job\s+(.+?)(?:$|[–\-|#:]|req|id)/i,
    /acknowledg(e)?ment.*?\b(?:for|–|-|:)\s*(.+)$/i,
    /your\s+application.*?\bfor\s+(.+?)$/i
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) {
      const title = (m[2] || m[1] || '').replace(/\s*[-–|#].*$/, '').trim();
      if (title) return { jobTitle: title };
    }
  }

  const comp = s.match(/applying\s+(?:to|at)\s+(.+?)(?:$|[–\-|#:])/i);
  if (comp) return { company: comp[1].trim() };

  return null;
}

function grabJobTitleFromBody(body) {
  const patterns = [
    /(?:Position|Job\s*Title|Role|Job)[\s:–-]+([^\n]+)/i,
    /applying\s+for\s+(?:the\s+)?(?:position\s+of\s+)?([^\n!.]+)/i,
    /hired\s+for\s+(?:the\s+)?(?:position\s+of\s+)?([^\n!.]+)/i,
    /(?:^|\n)\s*Position:\s*([^\n]+)/i,
    /for\s+the\s+([^,\n]+?)\s+(?:position|role)/i
  ];
  const cleanBody = strip(body);
  for (const pattern of patterns) {
    const match = cleanBody.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[!.,;]*$/, '');
    }
  }
  return null;
}

// 🔧 BROADENED company extraction (handles “apply to Spectrum”, “application was received by/at X”, signatures)
function grabCompanyFromBody(body) {
  const text = strip(body);

  const patterns = [
    /thank\s+you\s+for\s+applying\s+(?:to|at)\s+([A-Z][^\n!.]+?)(?:[.!]|$)/i,
    /\bapply\s+(?:to|at)\s+([A-Z][^\n!.]+?)(?:[.!]|$)/i,
    /\bapplied\s+(?:to|at)\s+([A-Z][^\n!.]+?)(?:[.!]|$)/i,
    /\byour\s+application\s+(?:has\s+been\s+)?(?:was\s+)?received.*?\b(?:at|by)\s+([A-Z][A-Za-z0-9 .&\-]+)\b/i,
    /\bapplication\s+(?:has\s+been\s+)?(?:was\s+)?received.*?\b(?:at|by)\s+([A-Z][A-Za-z0-9 .&\-]+)\b/i,
    /applying\s+(?:to|at)\s+([^\n!.]+?)(?:[!.]|$)/i,
    /welcome\s+to\s+([^\n!.]+?)(?:[!.]|$)/i,
    /\b([A-Z][A-Za-z0-9 .&\-]+)\s+(?:Recruiting|Recruitment|Talent|Careers)\b/i
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const company = cleanCompanyName(m[1]);
      if (company) return company;
    }
  }
  return null;
}

function findInlineDate(text) {
  const clean = strip(text || '');
  const iso = clean.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (iso) return new Date(iso[0]);
  return null;
}

function parseDateLoose(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/* ───────── prompt ───────── */
const SYSTEM = `You extract job application details from emails.

Return ONLY valid JSON matching:
{
  "jobTitle": "string or null",
  "company": "string or null",
  "platform": "string or null",
  "dateApplied": "YYYY-MM-DD or null"
}

Rules:
- If missing, set fields to null.
- If platform can be inferred (e.g., Workday/Greenhouse/Lever/Ashby/Oracle Recruiting Cloud/SmartRecruiters/iCIMS/SuccessFactors/BambooHR/Rippling/LinkedIn/Indeed), include it.
- Prefer job title from Subject if explicit (e.g., "application for job Software Engineer - 766").
- Prefer company from From header display name or body ("Thank you for applying to ...").
- Use today's date if no explicit date is present in the email text.`;

/* ───────── Gemini call (keep your current model) ───────── */
async function callGemini(prompt) {
  try {
    console.log('🤖 Making Gemini API call...');
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 10000
      }
    );
    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('🤖 Gemini raw response:', result);
    return result;
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

/* ───────── fallback ───────── */
function makeFallback(emailText, meta = {}) {
  console.log('🔧 Using fallback extraction...');
  const body = emailText || '';
  const fromHeader = meta.from || '';
  const subject = meta.subject || '';

  const subj = extractFromSubject(subject) || {};
  const jobTitle = subj.jobTitle || grabJobTitleFromBody(body);
  const company = subj.company || grabCompanyFromBody(body) || extractCompanyFromFromHeader(fromHeader);
  const platform = safePlatformFromFromOrDomain(fromHeader);
  const inlineDate = findInlineDate(emailText);
  const dateApplied = inlineDate ? inlineDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const result = { jobTitle: jobTitle || null, company: company || null, platform: platform || null, dateApplied };
  console.log('✅ Fallback extraction:', result);
  return result;
}

/* ───────── main extractor ───────── */
async function extractWithGemini(emailText, meta = {}) {
  console.log('🤖 Starting extraction process...');
  console.log('📧 Email text length:', emailText.length);
  console.log('📧 Email preview:', emailText.slice(0, 300));

  const prompt = `${SYSTEM}

SUBJECT: ${meta.subject || ''}
FROM: ${meta.from || ''}
DATE: ${meta.date || ''}

EMAIL:
${emailText}`;

  // 1) Try Gemini first
  try {
    const raw = await callGemini(prompt);
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    if (parsed) {
      const validation = ExtractedSchema.safeParse(parsed);
      if (validation.success) {
        let data = validation.data;

        // Patch missing fields (order: subject → body → from)
        if (!data.jobTitle) {
          const subj = extractFromSubject(meta.subject || '');
          data.jobTitle = subj?.jobTitle || grabJobTitleFromBody(emailText) || null;
        }
        if (!data.company) {
          const subj = extractFromSubject(meta.subject || '');
          data.company =
            subj?.company ||
            grabCompanyFromBody(emailText) ||         // ← broadened matcher
            extractCompanyFromFromHeader(meta.from || '') ||
            null;
        }
        if (!data.platform) {
          data.platform = safePlatformFromFromOrDomain(meta.from || '');
        }
        if (!data.dateApplied) {
          const inlineDate = findInlineDate(emailText);
          data.dateApplied = (inlineDate ? inlineDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
        }

        console.log('✅ Gemini extraction successful:', data);
        return data;
      }
    }
    console.log('❌ Gemini parse/validation failed; falling back.');
  } catch (e) {
    console.log('❌ Gemini call failed:', e.message);
  }

  // 2) Fallback to regex extraction
  return makeFallback(emailText, meta);
}

module.exports = {
  extractWithGemini,
  extractFromSubject,
  extractCompanyFromFromHeader,
  safePlatformFromFromOrDomain,
  parseDateLoose
};
