/**
 * POST /api/analyze
 * Body: { fullName, email, phone, companyName, productService, businessName, websiteUrl, socialUrls }
 * Returns: { jobId }
 *
 * Saves lead to Supabase, kicks off analysis in background, links lead to report.
 */
const { v4: uuidv4 } = require('uuid');
const { sql } = require('@vercel/postgres');

// Simple in-memory rate limiter (per IP, resets on cold start)
const ipHits = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const maxReq = 5;
  const entry = ipHits.get(ip) || { count: 0, start: now };
  if (now - entry.start > window) {
    ipHits.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= maxReq) return true;
  entry.count++;
  ipHits.set(ip, entry);
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (rateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta en una hora.' });
  }

  const {
    fullName,
    email,
    phone,
    companyName,
    productService,
    businessName,
    websiteUrl,
    socialUrls = {},
  } = req.body || {};

  // Validate required lead fields
  if (!fullName || !email || !phone || !companyName || !productService) {
    return res.status(400).json({ error: 'Los datos de contacto son obligatorios.' });
  }

  // Validate at least one URL
  const hasUrl =
    (websiteUrl && websiteUrl.trim()) ||
    Object.values(socialUrls).some(v => v && v.trim());

  if (!hasUrl) {
    return res.status(400).json({ error: 'Debes ingresar al menos un link (web o red social).' });
  }

  // Validate websiteUrl if provided
  if (websiteUrl && websiteUrl.trim()) {
    try { new URL(websiteUrl); } catch {
      return res.status(400).json({ error: 'websiteUrl no es una URL válida' });
    }
  }

  const jobId = uuidv4();
  const effectiveBusinessName = businessName || companyName;

  try {
    // 1. Create the report record
    await sql`
      INSERT INTO reports (id, business_name, website_url, social_urls, status)
      VALUES (${jobId}, ${effectiveBusinessName}, ${websiteUrl || ''}, ${JSON.stringify(socialUrls)}, 'pending')
    `;

    // 2. Save the lead, linked to this report (non-fatal)
    try {
      await sql`
        INSERT INTO leads (full_name, email, phone, company_name, product_service, website_url, facebook_url, instagram_url, tiktok_url, linkedin_url, report_id)
        VALUES (${fullName}, ${email}, ${phone}, ${companyName}, ${productService}, ${websiteUrl || null}, ${socialUrls.facebook || null}, ${socialUrls.instagram || null}, ${socialUrls.tiktok || null}, ${socialUrls.linkedin || null}, ${jobId})
      `;
    } catch (leadErr) {
      console.error('Lead insert error:', leadErr);
    }
  } catch (err) {
    console.error('DB insert error:', err);
    return res.status(500).json({ error: 'Error al crear el reporte: ' + err.message });
  }

  // Trigger analysis in background (fire-and-forget within Vercel's 60s limit)
  runAnalysisBackground(jobId, effectiveBusinessName, websiteUrl || '', socialUrls).catch(console.error);

  res.status(202).json({ jobId });
};

async function runAnalysisBackground(jobId, businessName, websiteUrl, socialUrls) {
  const { sql } = require('@vercel/postgres');

  async function updateStatus(status, extra = {}) {
    const sets = ['status = ' + `'${status}'`];
    // Build dynamic update via individual calls to keep it simple
    await sql`UPDATE reports SET status = ${status} WHERE id = ${jobId}`;
    if (extra.raw_data !== undefined) {
      await sql`UPDATE reports SET raw_data = ${JSON.stringify(extra.raw_data)} WHERE id = ${jobId}`;
    }
  }

  try {
    await sql`UPDATE reports SET status = 'running' WHERE id = ${jobId}`;

    const { runAllCollectors } = require('../src/collectors/index');
    const { buildReport } = require('../src/report/builder');

    const progressLog = [];
    const onProgress = async (step, status) => {
      progressLog.push({ step, status, ts: Date.now() });
      await sql`UPDATE reports SET raw_data = ${JSON.stringify({ _progress: progressLog })} WHERE id = ${jobId}`.catch(() => {});
    };

    const rawData = await runAllCollectors({ websiteUrl, socialUrls, onProgress });
    const report = await buildReport({ businessName, websiteUrl, socialUrls, rawData });

    await sql`
      UPDATE reports SET
        status = 'done',
        raw_data = ${JSON.stringify(rawData)},
        scores = ${JSON.stringify(report.scores)},
        interpreted = ${JSON.stringify(report.interpreted)},
        ai_diagnosis = ${JSON.stringify(report.aiDiagnosis)},
        global_score = ${report.globalScore}
      WHERE id = ${jobId}
    `;
  } catch (err) {
    console.error('Analysis error:', err);
    await sql`UPDATE reports SET status = 'error', raw_data = ${JSON.stringify({ error: err.message })} WHERE id = ${jobId}`.catch(() => {});
  }
}
