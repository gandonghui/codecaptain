import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'resources', 'icons');
const svgPath = path.join(iconsDir, 'app-icon.svg');
const pngPath = path.join(iconsDir, 'app-icon.png');

async function build() {
  const svgBuffer = fs.readFileSync(svgPath);
  await sharp(svgBuffer)
    .png()
    .toFile(pngPath);
  console.log(`Generated ${pngPath}`);
}

build().catch(console.error);
