/**
 * POST /api/analyze
 * Body: { businessName, websiteUrl, socialUrls: { facebook, instagram, tiktok, linkedin, youtube } }
 * Returns: { jobId }
 *
 * Kicks off analysis in background (Vercel background functions are limited,
 * so we start the job, persist to Supabase, and return jobId for SSE polling).
 */
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

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

  const { businessName, websiteUrl, socialUrls = {} } = req.body || {};

  if (!businessName || !websiteUrl) {
    return res.status(400).json({ error: 'businessName y websiteUrl son requeridos' });
  }

  // Validate URL
  try { new URL(websiteUrl); } catch {
    return res.status(400).json({ error: 'websiteUrl no es una URL válida' });
  }

  const jobId = uuidv4();

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('reports').insert({
      id: jobId,
      business_name: businessName,
      website_url: websiteUrl,
      social_urls: socialUrls,
      status: 'pending',
    });

    if (error) throw error;
  } catch (err) {
    console.error('Supabase insert error:', err);
    return res.status(500).json({ error: 'Error al crear el reporte: ' + err.message });
  }

  // Trigger analysis in background (fire-and-forget within Vercel's 60s limit)
  runAnalysisBackground(jobId, businessName, websiteUrl, socialUrls).catch(console.error);

  res.status(202).json({ jobId });
};

async function runAnalysisBackground(jobId, businessName, websiteUrl, socialUrls) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  async function updateStatus(status, extra = {}) {
    await supabase.from('reports').update({ status, ...extra }).eq('id', jobId);
  }

  try {
    await updateStatus('running');

    const { runAllCollectors } = require('../src/collectors/index');
    const { buildReport } = require('../src/report/builder');

    // Progress stored in a separate key — SSE endpoint reads from Supabase
    const progressLog = [];
    const onProgress = async (step, status) => {
      progressLog.push({ step, status, ts: Date.now() });
      await supabase
        .from('reports')
        .update({ raw_data: { _progress: progressLog } })
        .eq('id', jobId)
        .then(() => {})
        .catch(() => {});
    };

    const rawData = await runAllCollectors({ websiteUrl, socialUrls, onProgress });
    const report = await buildReport({ businessName, websiteUrl, socialUrls, rawData });

    await supabase.from('reports').update({
      status: 'done',
      raw_data: rawData,
      scores: report.scores,
      interpreted: report.interpreted,
      ai_diagnosis: report.aiDiagnosis,
      global_score: report.globalScore,
    }).eq('id', jobId);
  } catch (err) {
    console.error('Analysis error:', err);
    await supabase
      .from('reports')
      .update({ status: 'error', raw_data: { error: err.message } })
      .eq('id', jobId)
      .catch(() => {});
  }
}
