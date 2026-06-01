/**
 * PDF generator — renders report.html via Puppeteer and returns PDF buffer
 */

async function generatePdf(reportUrl, businessName) {
  let browser;
  try {
    const puppeteer = require('puppeteer-core');

    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      const chromium = require('@sparticuz/chromium');
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const localPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ];
      const fs = require('fs');
      let executablePath;
      for (const p of localPaths) {
        if (fs.existsSync(p)) { executablePath = p; break; }
      }
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('.report-loaded', { timeout: 10000 }).catch(() => {});

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });

    await browser.close();

    const date = new Date().toISOString().split('T')[0];
    const safeName = (businessName || 'negocio').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `diagnostico-${safeName}-${date}.pdf`;

    return { buffer: pdfBuffer, filename };
  } catch (err) {
    if (browser) try { await browser.close(); } catch {}
    throw err;
  }
}

module.exports = { generatePdf };
