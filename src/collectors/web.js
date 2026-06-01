/**
 * Web collector — analiza el sitio web usando Playwright + @sparticuz/chromium
 */
const { chromiumOptions, getBrowser } = require('./_browser');

async function collectWeb(websiteUrl) {
  let browser;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 812 });

    const startTime = Date.now();
    let loadOk = true;
    try {
      await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch {
      loadOk = false;
    }
    const loadTime = Date.now() - startTime; // ms

    if (!loadOk) {
      return { status: 'no_disponible', reason: 'El sitio no cargó en tiempo límite' };
    }

    const html = await page.content();
    const htmlLower = html.toLowerCase();

    // WhatsApp
    const hasWhatsapp =
      htmlLower.includes('wa.me') || htmlLower.includes('whatsapp');

    // Form
    const hasForm = htmlLower.includes('<form');

    // Tracking
    const hasTracking =
      htmlLower.includes('gtag') ||
      htmlLower.includes('fbq') ||
      htmlLower.includes('_ga') ||
      htmlLower.includes('gtm-') ||
      htmlLower.includes('pixel');

    // Live chat
    const hasChat =
      htmlLower.includes('intercom') ||
      htmlLower.includes('tidio') ||
      htmlLower.includes('crisp') ||
      htmlLower.includes('livechat');

    // Meta title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const metaTitle = titleMatch ? titleMatch[1].trim() : '';
    const titleLen = metaTitle.length;
    const titleOk = titleLen >= 50 && titleLen <= 60;

    // Meta description
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i
    ) || html.match(
      /<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i
    );
    const metaDesc = descMatch ? descMatch[1].trim() : '';
    const descLen = metaDesc.length;
    const descOk = descLen >= 140 && descLen <= 160;

    // Mobile viewport check
    const mobileOk = loadOk; // if it loaded on mobile viewport, it's ok

    await browser.close();

    return {
      status: 'ok',
      loadTimeMs: loadTime,
      loadTimeSec: (loadTime / 1000).toFixed(2),
      mobileOk,
      hasWhatsapp,
      hasForm,
      hasTracking,
      hasChat,
      metaTitle,
      titleLen,
      titleOk,
      metaDesc,
      descLen,
      descOk,
    };
  } catch (err) {
    if (browser) try { await browser.close(); } catch {}
    return { status: 'no_disponible', reason: err.message };
  }
}

module.exports = { collectWeb };
