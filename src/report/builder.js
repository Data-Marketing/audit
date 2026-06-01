/**
 * Report builder — assembles all data into a report object
 */
const { scoreAll } = require('../analyzer/scorer');
const { interpretAll } = require('../analyzer/interpreter');
const { generateDiagnosis, getActiveAI } = require('../analyzer/ai');

async function buildReport({ businessName, websiteUrl, socialUrls, rawData }) {
  const scored = scoreAll(rawData);
  const interpreted = interpretAll(rawData, scored);

  let aiDiagnosis = null;
  const ai = getActiveAI();
  if (ai) {
    try {
      aiDiagnosis = await generateDiagnosis({
        ...ai,
        metrics: {
          businessName,
          globalScore: scored.globalScore,
          scores: scored.scores,
          criticalFindings: interpreted.criticalFindings,
        },
      });
    } catch (err) {
      aiDiagnosis = { error: err.message };
    }
  }

  return {
    businessName,
    websiteUrl,
    socialUrls,
    rawData,
    scores: scored.scores,
    globalScore: scored.globalScore,
    semaforo: scored.semaforo,
    interpreted,
    aiDiagnosis,
    generatedAt: new Date().toISOString(),
    ctaLink: process.env.CTA_LINK || '',
    ctaName: process.env.CTA_NAME || '',
    agencyName: process.env.AGENCY_NAME || 'Heros Digital',
    agencyUrl: process.env.AGENCY_URL || '',
  };
}

module.exports = { buildReport };
