import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '../public/logo.svg');
const svgBuffer = fs.readFileSync(svgPath);

function renderPng(width, outputPath) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const image = resvg.render();
  const pngBuffer = image.asPng();
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: ${outputPath} (${width}px)`);
}

renderPng(1000, path.join(__dirname, '../public/logo.png'));
renderPng(1200, path.join(__dirname, '../public/og-image.png'));
renderPng(512, path.join(__dirname, '../public/pwa-512.png'));
renderPng(192, path.join(__dirname, '../public/pwa-192.png'));
renderPng(512, path.join(__dirname, '../public/icon-512.png'));
renderPng(192, path.join(__dirname, '../public/icon-192.png'));
renderPng(180, path.join(__dirname, '../public/apple-touch-icon.png'));
renderPng(180, path.join(__dirname, '../public/apple-touch-icon-precomposed.png'));
renderPng(64, path.join(__dirname, '../public/favicon.png'));
renderPng(64, path.join(__dirname, '../public/favicon.ico'));
renderPng(32, path.join(__dirname, '../public/favicon-32x32.png'));
renderPng(16, path.join(__dirname, '../public/favicon-16x16.png'));
