const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const pngPath = path.join(__dirname, '../public/logo.png');
  const svgPath = path.join(__dirname, '../public/logo.svg');
  const masterBuffer = fs.existsSync(pngPath) ? fs.readFileSync(pngPath) : fs.readFileSync(svgPath);

  const targets = [
    { out: '../public/logo.png', width: 512, height: 512 },
    { out: '../src/assets/logo.png', width: 512, height: 512 },
    { out: '../public/icon-512.png', width: 512, height: 512 },
    { out: '../public/pwa-512.png', width: 512, height: 512 },
    { out: '../public/icon-192.png', width: 192, height: 192 },
    { out: '../public/pwa-192.png', width: 192, height: 192 },
    { out: '../public/apple-touch-icon.png', width: 180, height: 180 },
    { out: '../public/apple-touch-icon-precomposed.png', width: 180, height: 180 },
    { out: '../public/favicon-32x32.png', width: 32, height: 32 },
    { out: '../public/favicon-16x16.png', width: 16, height: 16 },
    { out: '../public/favicon.png', width: 32, height: 32 },
    { out: '../public/favicon.ico', width: 32, height: 32 },
    { out: '../public/og-image.png', width: 1200, height: 630, fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } },
  ];

  for (const t of targets) {
    const outputPath = path.join(__dirname, t.out);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (t.fit === 'contain') {
      await sharp(masterBuffer)
        .resize(t.width, t.height, { fit: 'contain', background: t.background })
        .png()
        .toFile(outputPath);
    } else {
      await sharp(masterBuffer)
        .resize(t.width, t.height)
        .png()
        .toFile(outputPath);
    }
    console.log(`Generated: ${t.out} (${t.width}x${t.height})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
