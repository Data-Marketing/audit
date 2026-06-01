/**
 * Facebook collector — Playwright scraping
 */
const { getBrowser } = require('./_browser');

async function collectFacebook(profileUrl) {
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

    // Followers / likes — Facebook shows "X seguidores" or "X followers"
    let followers = null;
    const followerMatch = text.match(/([\d,.]+)\s*(seguidores|followers)/i);
    if (followerMatch) {
      followers = parseNumber(followerMatch[1]);
    }
    const likeMatch = text.match(/([\d,.]+)\s*(me gusta|likes)/i);
    const likes = likeMatch ? parseNumber(likeMatch[1]) : null;

    // Profile photo
    const hasProfilePhoto = html.includes('og:image') || html.includes('profile');

    // Bio / about
    const hasBio = text.length > 200;

    // Link in bio (external link present)
    const hasLink = html.includes('l.facebook.com') || html.includes('href="http');

    // Posts visible — count article or role="article" elements
    const postCount = (html.match(/role="article"/g) || []).length;

    // Video content
    const hasVideo =
      html.includes('video') ||
      html.includes('reel') ||
      text.toLowerCase().includes('reel');

    // Last post date — rough heuristic from timestamps
    const lastPostDays = estimateLastPostDays(text);

    await browser.close();

    return {
      status: 'ok',
      followers: followers || likes,
      likes,
      hasProfilePhoto,
      hasBio,
      hasLink,
      postCount,
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
  const clean = str.replace(/[,.\s]/g, '');
  const n = parseInt(clean, 10);
  if (str.toLowerCase().includes('k')) return n * 1000;
  if (str.toLowerCase().includes('m')) return n * 1000000;
  return isNaN(n) ? null : n;
}

function estimateLastPostDays(text) {
  if (text.match(/hace\s+\d+\s+min|just now|moments ago/i)) return 0;
  if (text.match(/hace\s+1\s+hora|1 hour ago|1h/i)) return 0;
  if (text.match(/hace\s+(\d+)\s+horas?|(\d+) hours? ago/i)) return 0;
  if (text.match(/ayer|yesterday/i)) return 1;
  const dayMatch = text.match(/hace\s+(\d+)\s+días?|(\d+) days? ago/i);
  if (dayMatch) return parseInt(dayMatch[1] || dayMatch[2]);
  const weekMatch = text.match(/hace\s+(\d+)\s+semanas?|(\d+) weeks? ago/i);
  if (weekMatch) return parseInt(weekMatch[1] || weekMatch[2]) * 7;
  return null;
}

function estimateFrequency(postCount, lastPostDays) {
  if (!postCount || !lastPostDays || lastPostDays === 0) return null;
  const weeks = lastPostDays / 7;
  return weeks > 0 ? (postCount / weeks).toFixed(1) : null;
}

module.exports = { collectFacebook };
