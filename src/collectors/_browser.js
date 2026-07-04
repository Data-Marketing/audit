/**
 * Shared Chromium browser factory
 * Uses @sparticuz/chromium on Vercel serverless, system Chrome locally
 */

const fs = require('fs');
const path = require('path');

function isServerlessProduction() {
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) return true;
  // VERCEL=1 is set even during `vercel dev`; use VERCEL_ENV to tell them apart
  const env = process.env.VERCEL_ENV;
  return env === 'production' || env === 'preview';
}

function getLocalChromePaths() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    paths.unshift(
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  }

  return paths;
}

function findLocalExecutable() {
  for (const p of getLocalChromePaths()) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function launchLocalBrowser(chromium) {
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };

  // Playwright auto-detects Chrome/Edge on Windows, macOS, Linux
  try {
    return await chromium.launch({ ...launchOpts, channel: 'chrome' });
  } catch {
    // channel not available — fall through to explicit path
  }

  const executablePath = findLocalExecutable();
  if (!executablePath) {
    throw new Error(
      'No se encontró Chrome ni Edge. Instala Google Chrome para ejecutar el análisis en local.'
    );
  }

  return chromium.launch({ ...launchOpts, executablePath });
}

async function getBrowser() {
  const { chromium } = require('playwright-core');

  if (isServerlessProduction()) {
    const chromiumPkg = require('@sparticuz/chromium');
    const executablePath = await chromiumPkg.executablePath();
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath,
      headless: chromiumPkg.headless,
    });
  }

  return launchLocalBrowser(chromium);
}

module.exports = { getBrowser, isServerlessProduction, findLocalExecutable };
