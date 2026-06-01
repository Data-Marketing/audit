/**
 * GET /api/progress/:jobId
 * Server-Sent Events stream for job progress
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const { jobId } = req.query;

  if (!jobId) return res.status(400).json({ error: 'jobId requerido' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const pollInterval = 2000;
  let seen = new Set();
  let done = false;
  let attempts = 0;
  const maxAttempts = 60; // 2min max

  const poll = async () => {
    if (done) return;
    attempts++;

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('status, raw_data, global_score')
        .eq('id', jobId)
        .single();

      if (error || !data) {
        send('error', { message: 'Reporte no encontrado' });
        res.end();
        return;
      }

      // Emit progress events
      const progress = data.raw_data?._progress || [];
      for (const p of progress) {
        const key = `${p.step}-${p.status}`;
        if (!seen.has(key)) {
          seen.add(key);
          send('progress', { step: p.step, status: p.status });
        }
      }

      if (data.status === 'done') {
        send('done', { reportId: jobId, globalScore: data.global_score });
        done = true;
        res.end();
        return;
      }

      if (data.status === 'error') {
        send('error', { message: 'El análisis falló. Por favor intenta nuevamente.' });
        done = true;
        res.end();
        return;
      }

      if (attempts >= maxAttempts) {
        send('error', { message: 'Tiempo de espera agotado.' });
        res.end();
        return;
      }

      setTimeout(poll, pollInterval);
    } catch (err) {
      send('error', { message: err.message });
      res.end();
    }
  };

  poll();

  req.on('close', () => { done = true; });
};
