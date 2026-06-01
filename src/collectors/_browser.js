/**
 * Shared Chromium browser factory
 * Uses @sparticuz/chromium in production (Vercel), local Chrome in dev
 */

async function getBrowser() {
  const { chromium } = require('playwright-core');

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL) {
    // Production: use @sparticuz/chromium
    const chromiumPkg = require('@sparticuz/chromium');
    const executablePath = await chromiumPkg.executablePath();
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath,
      headless: chromiumPkg.headless,
    });
  }

  // Local dev: use system Chrome or chromium
  const localPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  const fs = require('fs');
  let executablePath;
  for (const p of localPaths) {
    if (fs.existsSync(p)) { executablePath = p; break; }
  }

  return chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

module.exports = { getBrowser };
