/**
 * GET /api/export/pdf/:reportId
 * Generates and streams a PDF of the report
 */
const { createClient } = require('@supabase/supabase-js');
const { generatePdf } = require('../../../src/report/pdf');

module.exports = async function handler(req, res) {
  const { reportId } = req.query;

  if (!reportId) return res.status(400).json({ error: 'reportId requerido' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('reports')
    .select('business_name, status')
    .eq('id', reportId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Reporte no encontrado' });
  if (data.status !== 'done') return res.status(400).json({ error: 'El reporte aún no está listo' });

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:3000`;

    const reportUrl = `${baseUrl}/report/${reportId}`;
    const { buffer, filename } = await generatePdf(reportUrl, data.business_name);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'Error generando PDF: ' + err.message });
  }
};
