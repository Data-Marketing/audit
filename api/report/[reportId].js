/**
 * GET /api/report/:reportId
 * Returns full report JSON
 */
const { createClient } = require('@supabase/supabase-js');
const { buildReport } = require('../../src/report/builder');

module.exports = async function handler(req, res) {
  const { reportId } = req.query;

  if (!reportId) return res.status(400).json({ error: 'reportId requerido' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Reporte no encontrado' });
  }

  if (data.status !== 'done') {
    return res.status(202).json({ status: data.status });
  }

  // Reconstruct report object from stored data
  const report = {
    id: data.id,
    businessName: data.business_name,
    websiteUrl: data.website_url,
    socialUrls: data.social_urls,
    rawData: data.raw_data,
    scores: data.scores,
    globalScore: data.global_score,
    semaforo: data.global_score >= 80 ? 'verde' : data.global_score >= 60 ? 'amarillo' : 'rojo',
    interpreted: data.interpreted,
    aiDiagnosis: data.ai_diagnosis,
    generatedAt: data.created_at,
    ctaLink: process.env.CTA_LINK || '',
    ctaName: process.env.CTA_NAME || '',
    agencyName: process.env.AGENCY_NAME || 'Heros Digital',
    agencyUrl: process.env.AGENCY_URL || '',
  };

  res.setHeader('Cache-Control', 's-maxage=3600');
  res.status(200).json(report);
};
