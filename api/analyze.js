/**
 * POST /api/analyze
 * Body: { fullName, email, phone, companyName, productService, businessName, websiteUrl, socialUrls }
 * Returns: { jobId }
 *
 * Saves lead to Supabase, kicks off analysis in background, links lead to report.
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
    const supabase = getSupabase();

    // 1. Create the report record
    const { error: reportError } = await supabase.from('reports').insert({
      id: jobId,
      business_name: effectiveBusinessName,
      website_url: websiteUrl || '',
      social_urls: socialUrls,
      status: 'pending',
    });
    if (reportError) throw reportError;

    // 2. Save the lead, linked to this report
    const { error: leadError } = await supabase.from('leads').insert({
      full_name: fullName,
      email,
      phone,
      company_name: companyName,
      product_service: productService,
      website_url: websiteUrl || null,
      facebook_url: socialUrls.facebook || null,
      instagram_url: socialUrls.instagram || null,
      tiktok_url: socialUrls.tiktok || null,
      linkedin_url: socialUrls.linkedin || null,
      report_id: jobId,
    });
    if (leadError) {
      // Non-fatal — log but don't block the analysis
      console.error('Lead insert error:', leadError);
    }
  } catch (err) {
    console.error('Supabase insert error:', err);
    return res.status(500).json({ error: 'Error al crear el reporte: ' + err.message });
  }

  // Trigger analysis in background (fire-and-forget within Vercel's 60s limit)
  runAnalysisBackground(jobId, effectiveBusinessName, websiteUrl || '', socialUrls).catch(console.error);

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
