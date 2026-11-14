import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const svgContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .icon-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
      }
      svg {
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
      }
    </style>
  </head>
  <body>
    <div class="icon-container">
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
        <path d="M2 7h20"/>
        <circle cx="12" cy="11" r="2" fill="white"/>
      </svg>
    </div>
  </body>
  </html>
  `;

  await page.setContent(svgContent);

  const outDir = path.resolve('frontend/public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 192x192
  await page.setViewportSize({ width: 192, height: 192 });
  await page.screenshot({ path: path.join(outDir, 'icon-192.png') });
  console.log('Generated icon-192.png');

  // 512x512
  await page.setViewportSize({ width: 512, height: 512 });
  await page.screenshot({ path: path.join(outDir, 'icon-512.png') });
  console.log('Generated icon-512.png');

  // Apple touch icon 180x180
  await page.setViewportSize({ width: 180, height: 180 });
  await page.screenshot({ path: path.join(outDir, 'apple-touch-icon.png') });
  console.log('Generated apple-touch-icon.png');

  await browser.close();
  console.log('All icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});

