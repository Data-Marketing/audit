/**
 * TikTok collector — Playwright scraping
 */
const { getBrowser } = require('./_browser');

async function collectTiktok(profileUrl) {
  if (!profileUrl) return { status: 'no_disponible', reason: 'URL no proporcionada' };

  let browser;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);

    const html = await page.content();
    const text = await page.innerText('body').catch(() => '');

    // Followers
    let followers = null;
    const followerMatch = text.match(/([\d,.]+[km]?)\s*seguidores|([\d,.]+[km]?)\s*Followers/i);
    if (followerMatch) {
      followers = parseNumber(followerMatch[1] || followerMatch[2]);
    }

    // Likes (total)
    let likes = null;
    const likeMatch = text.match(/([\d,.]+[km]?)\s*(Me gusta|Likes)/i);
    if (likeMatch) {
      likes = parseNumber(likeMatch[1]);
    }

    // Videos visible on profile
    const videoCount = (html.match(/video-feed-item/g) || []).length;

    // Bio
    const hasBio = !!html.match(/og:description.*content="[^"]{10,}"/i);

    // Link in bio
    const hasLink = html.includes('linktr.ee') || html.includes('linkin.bio') ||
      text.includes('http');

    // TikTok is all video
    const hasVideo = true;

    await browser.close();

    return {
      status: 'ok',
      followers,
      likes,
      videoCount,
      hasProfilePhoto: true, // TikTok always has profile photo
      hasBio,
      hasLink,
      hasVideo,
      lastPostDays: null,
      frequencyPerWeek: null,
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

module.exports = { collectTiktok };
