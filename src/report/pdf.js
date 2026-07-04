/**
 * PDF generator — renders report.html via Puppeteer and returns PDF buffer
 */

const { isServerlessProduction, findLocalExecutable } = require('../collectors/_browser');

async function generatePdf(reportUrl, businessName) {
  let browser;
  try {
    const puppeteer = require('puppeteer-core');
    const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };

    if (isServerlessProduction()) {
      const chromium = require('@sparticuz/chromium');
      browser = await puppeteer.launch({
        ...launchOpts,
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      try {
        browser = await puppeteer.launch({ ...launchOpts, channel: 'chrome' });
      } catch {
        const executablePath = findLocalExecutable();
        if (!executablePath) throw new Error('No se encontró Chrome para generar el PDF.');
        browser = await puppeteer.launch({ ...launchOpts, executablePath });
      }
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
