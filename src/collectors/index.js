/**
 * Collectors orchestrator
 * Runs all collectors and emits SSE progress events
 */
const { collectWeb } = require('./web');
const { collectSeo } = require('./seo');
const { collectFacebook } = require('./facebook');
const { collectInstagram } = require('./instagram');
const { collectTiktok } = require('./tiktok');
const { collectLinkedin } = require('./linkedin');
const { collectYoutube } = require('./youtube');

/**
 * @param {object} input
 * @param {string} input.websiteUrl
 * @param {object} input.socialUrls - { facebook, instagram, tiktok, linkedin, youtube }
 * @param {function} input.onProgress - callback(step: string, status: string)
 * @returns {Promise<object>} raw collected data keyed by collector name
 */
async function runAllCollectors({ websiteUrl, socialUrls = {}, onProgress = () => {} }) {
  const results = {};

  const run = async (name, fn, ...args) => {
    onProgress(name, 'running');
    try {
      const data = await Promise.race([
        fn(...args),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 55000)),
      ]);
      results[name] = data;
      onProgress(name, 'done');
    } catch (err) {
      results[name] = { status: 'no_disponible', reason: err.message };
      onProgress(name, 'error');
    }
  };

  // Sequential to avoid overloading browser instances
  await run('web', collectWeb, websiteUrl);
  await run('seo', collectSeo, websiteUrl);
  if (socialUrls.facebook)  await run('facebook',  collectFacebook,  socialUrls.facebook);
  if (socialUrls.instagram) await run('instagram', collectInstagram, socialUrls.instagram);
  if (socialUrls.tiktok)    await run('tiktok',    collectTiktok,    socialUrls.tiktok);
  if (socialUrls.linkedin)  await run('linkedin',  collectLinkedin,  socialUrls.linkedin);
  if (socialUrls.youtube)   await run('youtube',   collectYoutube,   socialUrls.youtube);

  return results;
}

module.exports = { runAllCollectors };
