/**
 * GET /api/export/pdf/:reportId
 * Generates and streams a PDF of the report
 */
const { sql } = require('@vercel/postgres');
const { generatePdf } = require('../../../src/report/pdf');

module.exports = async function handler(req, res) {
  const { reportId } = req.query;

  if (!reportId) return res.status(400).json({ error: 'reportId requerido' });

  const { rows } = await sql`SELECT business_name, status FROM reports WHERE id = ${reportId} LIMIT 1`;
  const data = rows[0];

  if (!data) return res.status(404).json({ error: 'Reporte no encontrado' });
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
