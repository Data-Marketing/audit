/**
 * Instagram collector — Playwright scraping
 */
const { getBrowser } = require('./_browser');

async function collectInstagram(profileUrl) {
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
    const followerMatch = text.match(/([\d,.]+[km]?)\s*seguidores|([\d,.]+[km]?)\s*followers/i);
    if (followerMatch) {
      followers = parseNumber(followerMatch[1] || followerMatch[2]);
    }

    // Posts count
    let postCount = null;
    const postMatch = text.match(/([\d,.]+)\s*publicaciones|([\d,.]+)\s*posts/i);
    if (postMatch) {
      postCount = parseNumber(postMatch[1] || postMatch[2]);
    }

    // Profile photo
    const hasProfilePhoto = html.includes('og:image');

    // Bio
    const hasBio = !!html.match(/og:description.*content="[^"]{10,}"/i);

    // Link in bio
    const hasLink = html.includes('linkin.bio') || html.includes('linktr.ee') ||
      text.includes('http') || html.includes('external_url');

    // Video / Reels
    const hasVideo = html.includes('reel') || html.includes('video');

    // Instagram doesn't easily expose last post date via scraping — approximate
    const lastPostDays = null;

    await browser.close();

    return {
      status: 'ok',
      followers,
      postCount,
      hasProfilePhoto,
      hasBio,
      hasLink,
      hasVideo,
      lastPostDays,
      frequencyPerWeek: null, // Can't reliably estimate without dates
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
  const n = parseFloat(str.replace(/[km,]/g, ''));
  return isNaN(n) ? null : Math.round(n * multiplier);
}

module.exports = { collectInstagram };
