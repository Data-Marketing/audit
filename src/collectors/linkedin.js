/**
 * LinkedIn collector — Playwright scraping
 */
const { getBrowser } = require('./_browser');

async function collectLinkedin(profileUrl) {
  if (!profileUrl) return { status: 'no_disponible', reason: 'URL no proporcionada' };

  let browser;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const html = await page.content();
    const text = await page.innerText('body').catch(() => '');

    // Followers / connections
    let followers = null;
    const followerMatch = text.match(/([\d,.]+[km]?)\s*(seguidores|followers)/i);
    if (followerMatch) {
      followers = parseNumber(followerMatch[1]);
    }

    // Posts visible
    const postCount = (html.match(/feed-shared-update-v2/g) || []).length;

    // Company page vs personal
    const isCompany = profileUrl.includes('/company/');

    // Bio / about
    const hasBio = html.includes('og:description');

    // Website link
    const hasLink = html.includes('company-website') || html.includes('website');

    // Video content
    const hasVideo = html.includes('video') || html.includes('dms_video');

    // Last post
    const lastPostDays = estimateLastPostDays(text);

    await browser.close();

    return {
      status: 'ok',
      followers,
      postCount,
      isCompany,
      hasBio,
      hasProfilePhoto: html.includes('company-logo') || html.includes('profile-photo'),
      hasLink,
      hasVideo,
      lastPostDays,
      frequencyPerWeek: estimateFrequency(postCount, lastPostDays),
    };
  } catch (err) {
    if (browser) try { await browser.close(); } catch {}
    return { status: 'no_disponible', reason: err.message };
  }
}

function parseNumber(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  const multiplier = str.endsWith('k') ? 1000 : str.endsWith('m') ? 1000000 : 1;
  const n = parseFloat(str.replace(/[km,\s]/g, ''));
  return isNaN(n) ? null : Math.round(n * multiplier);
}

function estimateLastPostDays(text) {
  if (text.match(/hace\s+\d+\s+min|just now/i)) return 0;
  if (text.match(/hace\s+1?\s*hora|1h|1 hour/i)) return 0;
  if (text.match(/ayer|yesterday/i)) return 1;
  const dayMatch = text.match(/hace\s+(\d+)\s+días?|(\d+)d\b/i);
  if (dayMatch) return parseInt(dayMatch[1] || dayMatch[2]);
  const weekMatch = text.match(/hace\s+(\d+)\s+semana|(\d+)w\b/i);
  if (weekMatch) return parseInt(weekMatch[1] || weekMatch[2]) * 7;
  return null;
}

function estimateFrequency(postCount, lastPostDays) {
  if (!postCount || !lastPostDays || lastPostDays === 0) return null;
  const weeks = lastPostDays / 7;
  return weeks > 0 ? (postCount / weeks).toFixed(1) : null;
}

module.exports = { collectLinkedin };
