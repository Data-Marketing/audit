/**
 * AI diagnosis module — intercambiable entre OpenAI, Anthropic, DeepSeek
 */

const SYSTEM_PROMPT = `Eres un consultor de marketing digital experto. Recibes métricas de presencia digital de una empresa y debes generar:
1. Un párrafo de diagnóstico (3–4 oraciones) en lenguaje empresarial, sin tecnicismos, dirigido al dueño del negocio.
2. Una lista de 3 a 5 recomendaciones priorizadas, ordenadas de mayor a menor impacto, en lenguaje de negocio.
Nunca uses términos técnicos como HTTPS, pixel, indexado, meta tag, API, SSL. Responde en español.`;

/**
 * @param {object} opts
 * @param {string} opts.provider - 'openai' | 'anthropic' | 'deepseek'
 * @param {string} opts.apiKey
 * @param {object} opts.metrics - scores and interpreted data
 * @returns {Promise<{ narrative: string, recommendations: string[] }>}
 */
async function generateDiagnosis({ provider, apiKey, metrics }) {
  const userContent = buildUserMessage(metrics);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiKey, userContent);
    case 'deepseek':
      return callDeepSeek(apiKey, userContent);
    case 'openai':
    default:
      return callOpenAI(apiKey, userContent);
  }
}

function buildUserMessage(metrics) {
  const lines = ['Aquí están las métricas de presencia digital de la empresa:\n'];

  if (metrics.businessName) lines.push(`Empresa: ${metrics.businessName}`);
  if (metrics.globalScore !== undefined) lines.push(`Puntuación global: ${metrics.globalScore}/100`);

  if (metrics.scores) {
    lines.push('\nPuntuaciones por área:');
    if (metrics.scores.web?.available) lines.push(`- Sitio web: ${metrics.scores.web.score}/100`);
    if (metrics.scores.google?.available) lines.push(`- Visibilidad en Google: ${metrics.scores.google.score}/100`);
    for (const net of ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube']) {
      if (metrics.scores[net]?.available) lines.push(`- ${capitalize(net)}: ${metrics.scores[net].score}/100`);
    }
  }

  if (metrics.criticalFindings?.length > 0) {
    lines.push('\nProblemas críticos identificados:');
    for (const f of metrics.criticalFindings) {
      lines.push(`- ${f.hallazgo}`);
    }
  }

  lines.push('\nGenera el diagnóstico y las recomendaciones.');
  return lines.join('\n');
}

async function callOpenAI(apiKey, userContent) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return parseAIResponse(data.choices?.[0]?.message?.content || '');
}

async function callAnthropic(apiKey, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return parseAIResponse(data.content?.[0]?.text || '');
}

async function callDeepSeek(apiKey, userContent) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return parseAIResponse(data.choices?.[0]?.message?.content || '');
}

function parseAIResponse(text) {
  if (!text) return { narrative: '', recommendations: [] };

  // Try to split narrative and recommendations
  const lines = text.split('\n').filter(l => l.trim());
  const recIdx = lines.findIndex(l =>
    l.match(/recomendaci[oó]n|prioridad|acción|siguiente paso/i)
  );

  let narrative = '';
  let recommendations = [];

  if (recIdx > 0) {
    narrative = lines.slice(0, recIdx).join(' ').trim();
    recommendations = lines
      .slice(recIdx)
      .filter(l => l.match(/^[-•*\d]/))
      .map(l => l.replace(/^[-•*\d.\s]+/, '').trim())
      .filter(Boolean);
  } else {
    // Fallback: first paragraph is narrative, bulleted lines are recommendations
    const bulletLines = lines.filter(l => l.match(/^[-•*\d]/));
    const narLines = lines.filter(l => !l.match(/^[-•*\d]/));
    narrative = narLines.join(' ').trim();
    recommendations = bulletLines
      .map(l => l.replace(/^[-•*\d.\s]+/, '').trim())
      .filter(Boolean);
  }

  return { narrative, recommendations };
}

function getActiveAI() {
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY };
  if (process.env.DEEPSEEK_API_KEY) return { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY };
  return null;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { generateDiagnosis, getActiveAI };
