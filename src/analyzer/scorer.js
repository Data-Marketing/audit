/**
 * Scorer — convierte raw data en puntuaciones por área
 */

function scoreWeb(web) {
  if (!web || web.status === 'no_disponible') return { score: 0, breakdown: {}, available: false };

  let score = 0;
  const breakdown = {};

  // Velocidad
  const loadSec = parseFloat(web.loadTimeSec || 99);
  if (loadSec < 2)      { score += 25; breakdown.velocidad = 25; }
  else if (loadSec < 4) { score += 15; breakdown.velocidad = 15; }
  else                  { score += 0;  breakdown.velocidad = 0;  }

  // Optimizado móvil
  if (web.mobileOk) { score += 20; breakdown.mobile = 20; }
  else               { breakdown.mobile = 0; }

  // WhatsApp
  if (web.hasWhatsapp) { score += 15; breakdown.whatsapp = 15; }
  else                  { breakdown.whatsapp = 0; }

  // Formulario
  if (web.hasForm) { score += 10; breakdown.form = 10; }
  else              { breakdown.form = 0; }

  // Sistema de medición
  if (web.hasTracking) { score += 20; breakdown.tracking = 20; }
  else                  { breakdown.tracking = 0; }

  // Chat en vivo
  if (web.hasChat) { score += 10; breakdown.chat = 10; }
  else              { breakdown.chat = 0; }

  return { score: Math.min(score, 100), breakdown, available: true };
}

function scoreGoogle(seo) {
  if (!seo || seo.status === 'no_disponible') return { score: 0, breakdown: {}, available: false };

  let score = 0;
  const breakdown = {};

  // Indexado
  if (seo.indexed?.indexed) { score += 20; breakdown.indexado = 20; }
  else                        { breakdown.indexado = 0; }

  // Ficha Google Maps
  if (seo.places?.found) { score += 30; breakdown.googleMaps = 30; }
  else                    { breakdown.googleMaps = 0; }

  // Rating
  const rating = seo.places?.rating ?? null;
  if (rating !== null) {
    if (rating >= 4.2)       { score += 25; breakdown.rating = 25; }
    else if (rating >= 3.5)  { score += 15; breakdown.rating = 15; }
    else                     { score += 5;  breakdown.rating = 5;  }
  } else { breakdown.rating = 0; }

  // Reseñas
  const reviews = seo.places?.totalReviews ?? 0;
  if (reviews >= 50)      { score += 25; breakdown.reviews = 25; }
  else if (reviews >= 10) { score += 15; breakdown.reviews = 15; }
  else if (reviews > 0)   { score += 5;  breakdown.reviews = 5;  }
  else                    { breakdown.reviews = 0; }

  return { score: Math.min(score, 100), breakdown, available: true };
}

function scoreSocial(data) {
  if (!data || data.status === 'no_disponible') return { score: 0, breakdown: {}, available: false };

  let score = 0;
  const breakdown = {};

  // Tiene perfil
  score += 10; breakdown.tienePerfl = 10;

  // Perfil completo
  const isComplete = data.hasProfilePhoto && data.hasBio && data.hasLink;
  if (isComplete) { score += 15; breakdown.perfilCompleto = 15; }
  else             { breakdown.perfilCompleto = 0; }

  // Seguidores
  const followers = data.followers ?? data.subscribers ?? 0;
  if (followers > 1000)       { score += 15; breakdown.seguidores = 15; }
  else if (followers >= 500)  { score += 10; breakdown.seguidores = 10; }
  else                        { score += 5;  breakdown.seguidores = 5;  }

  // Último post
  const lastPostDays = data.lastPostDays;
  if (lastPostDays !== null && lastPostDays !== undefined) {
    if (lastPostDays <= 3)       { score += 25; breakdown.ultimoPost = 25; }
    else if (lastPostDays <= 7)  { score += 15; breakdown.ultimoPost = 15; }
    else if (lastPostDays <= 14) { score += 10; breakdown.ultimoPost = 10; }
    else                         { score += 0;  breakdown.ultimoPost = 0;  }
  } else { breakdown.ultimoPost = 0; }

  // Frecuencia
  const freq = parseFloat(data.frequencyPerWeek || 0);
  if (freq >= 3)      { score += 20; breakdown.frecuencia = 20; }
  else if (freq >= 1) { score += 12; breakdown.frecuencia = 12; }
  else                { breakdown.frecuencia = 0; }

  // Video
  if (data.hasVideo) { score += 15; breakdown.video = 15; }
  else                { breakdown.video = 0; }

  return { score: Math.min(score, 100), breakdown, available: true };
}

function computeGlobalScore(scores, socialKeys) {
  const web = scores.web?.score ?? 0;
  const google = scores.google?.score ?? 0;

  const socialScores = socialKeys
    .filter(k => scores[k]?.available)
    .map(k => scores[k].score);

  const socialAvg = socialScores.length > 0
    ? socialScores.reduce((a, b) => a + b, 0) / socialScores.length
    : 0;

  // web 25% + google 25% + redes 50%
  const global = (web * 0.25) + (google * 0.25) + (socialAvg * 0.50);
  return Math.round(global);
}

function getTrafficLight(score) {
  if (score >= 80) return 'verde';
  if (score >= 60) return 'amarillo';
  return 'rojo';
}

function scoreAll(raw) {
  const socialKeys = ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'];

  const scores = {
    web: scoreWeb(raw.web),
    google: scoreGoogle(raw.seo),
  };

  for (const k of socialKeys) {
    if (raw[k]) scores[k] = scoreSocial(raw[k]);
  }

  const globalScore = computeGlobalScore(scores, socialKeys);
  const semaforo = getTrafficLight(globalScore);

  return { scores, globalScore, semaforo };
}

module.exports = { scoreAll, scoreWeb, scoreGoogle, scoreSocial, getTrafficLight };
