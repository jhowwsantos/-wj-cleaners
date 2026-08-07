// Note: Official W & J Cleaners logo is stored in public/logo.png and src/assets/logo.png.
// Do NOT overwrite logo.png with SVG renders.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const officialLogo = path.join(__dirname, '../public/logo.png');

if (fs.existsSync(officialLogo)) {
  const assetsToSync = [
    'og-image.png',
    'pwa-512.png',
    'pwa-192.png',
    'icon-512.png',
    'icon-192.png',
    'apple-touch-icon.png',
    'apple-touch-icon-precomposed.png',
    'favicon.png',
    'favicon.ico',
    'favicon-32x32.png',
    'favicon-16x16.png',
  ];

  for (const asset of assetsToSync) {
    fs.copyFileSync(officialLogo, path.join(__dirname, '../public', asset));
  }
  console.log('Official W & J Cleaners logo assets synchronized successfully.');
}

