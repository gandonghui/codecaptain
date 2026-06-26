#!/usr/bin/env node
/*
 * Generate all raster app-icon assets from a single source SVG.
 *
 *   source:  resources/icons/icon-source.svg   (square brand mark, transparent)
 *   outputs: resources/icons/icon.ico          (Windows app + NSIS installer icon)
 *            resources/icons/icon.png          (512px, generic)
 *            resources/icons/tray/trayTemplate-idle.png
 *            resources/icons/tray/trayTemplate-unseen.png
 *            resources/icons/tray/trayTemplate-breath-00..15.png
 *
 * Low-maintenance flow: to change the logo, replace icon-source.svg and re-run
 *   node packages/electron/scripts/gen-icons.mjs   (or: bun run --cwd packages/electron gen:icons)
 *
 * Only dependency is `sharp` (already a dev dependency).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '..', 'resources', 'icons');
const trayDir = path.join(iconsDir, 'tray');
const srcPath = path.join(iconsDir, 'icon-source.svg');

const APP_BG = '#ffffff';        // app/installer icon background (always-legible square)
const MARGIN = 0.84;             // mark scale inside the square (rest is padding)
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const TRAY_SIZE = 32;            // base tray size; Windows scales as needed
const TRAY_BREATH_FRAMES = 16;   // must match TRAY_BREATH_FRAME_COUNT in main.mjs

if (!fs.existsSync(srcPath)) {
  console.error(`[gen-icons] source not found: ${srcPath}`);
  process.exit(1);
}
const srcSvg = fs.readFileSync(srcPath, 'utf8');
// Tray icons are a single-colour silhouette. White reads on dark Windows taskbars;
// on macOS the tray uses template mode (alpha only), so white works there too.
const traySvg = srcSvg.replace(/rgb\(0,0,0\)/g, '#ffffff').replace(/rgb\(115,68,227\)/g, '#ffffff');

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const renderSquare = async (svg, size, background) => {
  const inner = Math.round(size * MARGIN);
  const pad = Math.floor((size - inner) / 2);
  const mark = await sharp(Buffer.from(svg))
    .resize(inner, inner, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();
    
  if (background === transparent) {
    return sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: mark, left: pad, top: pad }])
      .png()
      .toBuffer();
  }

  const rx = Math.round(size * 0.2246);
  const strokeW = Math.max(1, Math.round(size * (4 / 512)));
  const bgSvg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${strokeW/2}" y="${strokeW/2}" width="${size - strokeW}" height="${size - strokeW}" rx="${rx}" fill="${background}" stroke="#EBE8F2" stroke-width="${strokeW}"/>
  </svg>`);

  return sharp(bgSvg)
    .composite([{ input: mark, left: pad, top: pad }])
    .png()
    .toBuffer();
};

// Pack multiple PNG buffers into a Windows .ico (PNG-compressed entries).
const pngsToIco = (images) => {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);
  const entries = [];
  const blobs = [];
  let offset = 6 + count * 16;
  for (const { size, buffer } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 => 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    blobs.push(buffer);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
};

const main = async () => {
  fs.rmSync(trayDir, { recursive: true, force: true });
  fs.mkdirSync(trayDir, { recursive: true });

  // App icon (.ico) + icon.png — white background so it is legible everywhere.
  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, buffer: await renderSquare(srcSvg, size, APP_BG) });
  }
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), pngsToIco(icoImages));
  fs.writeFileSync(path.join(iconsDir, 'icon.png'), await renderSquare(srcSvg, 512, APP_BG));

  // Tray icons — white silhouette on transparent. idle/unseen/breath all static.
  const trayPng = await renderSquare(traySvg, TRAY_SIZE, transparent);
  const trayPng2x = await renderSquare(traySvg, TRAY_SIZE * 2, transparent);
  
  fs.writeFileSync(path.join(trayDir, 'trayTemplate-idle.png'), trayPng);
  fs.writeFileSync(path.join(trayDir, 'trayTemplate-idle@2x.png'), trayPng2x);
  fs.writeFileSync(path.join(trayDir, 'trayTemplate-unseen.png'), trayPng);
  fs.writeFileSync(path.join(trayDir, 'trayTemplate-unseen@2x.png'), trayPng2x);
  for (let i = 0; i < TRAY_BREATH_FRAMES; i++) {
    const padded = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(trayDir, `trayTemplate-breath-${padded}.png`), trayPng);
    fs.writeFileSync(path.join(trayDir, `trayTemplate-breath-${padded}@2x.png`), trayPng2x);
  }

  console.log(`[gen-icons] wrote icon.ico (${ICO_SIZES.join(',')}), icon.png, and tray frames.`);
  
  // === macOS AppIcon Assets Generation ===
  const macAssetsDir = path.join(iconsDir, 'AppIcon.icon', 'Assets');
  if (fs.existsSync(macAssetsDir)) {
    console.log('[gen-icons] generating macOS AppIcon glyphs...');
    // Mac App Icon layers (for macOS 11+ style icons in Xcode actool)
    // Dark mode: replace black with white, keep purple.
    const darkGlyphSvg = srcSvg.replace(/rgb\(0,0,0\)/g, '#ffffff');
    const renderMacGlyph = async (svgStr, size) => sharp(Buffer.from(svgStr)).resize(size, size, { fit: 'contain', background: transparent }).png().toBuffer();
    
    fs.writeFileSync(path.join(macAssetsDir, 'app-icon-glyph-light 2.png'), await renderMacGlyph(srcSvg, 1024));
    fs.writeFileSync(path.join(macAssetsDir, 'app-icon-glyph-dark 4.png'), await renderMacGlyph(darkGlyphSvg, 1024));
    console.log('[gen-icons] updated macOS AppIcon glyphs successfully.');
  }

  // === Web Icons Generation ===
  const webPublicDir = path.resolve(__dirname, '../../web/public');
  if (fs.existsSync(webPublicDir)) {
    console.log('[gen-icons] generating web/public icons...');
    
    // SVG copies
    fs.copyFileSync(srcPath, path.join(webPublicDir, 'favicon.svg'));
    fs.copyFileSync(srcPath, path.join(webPublicDir, 'apple-touch-icon.svg'));
    fs.copyFileSync(srcPath, path.join(webPublicDir, 'logo-dark-512x512.svg'));
    fs.copyFileSync(srcPath, path.join(webPublicDir, 'logo-light-512x512.svg'));

    // Helper for simple transparent resize (full size, no inner margin)
    const renderFull = async (size) => sharp(Buffer.from(srcSvg)).resize(size, size, { fit: 'contain', background: transparent }).png().toBuffer();
    // Helper for solid background (for Apple Touch & Maskable)
    const renderSolid = async (size) => {
      const inner = Math.round(size * MARGIN);
      const mark = await sharp(Buffer.from(srcSvg)).resize(inner, inner, { fit: 'contain', background: transparent }).png().toBuffer();
      return sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: mark }])
        .png().toBuffer();
    };

    // Favicons (transparent)
    fs.writeFileSync(path.join(webPublicDir, 'favicon-16.png'), await renderFull(16));
    fs.writeFileSync(path.join(webPublicDir, 'favicon-32.png'), await renderFull(32));
    fs.writeFileSync(path.join(webPublicDir, 'favicon.png'), await renderFull(32)); // default fallback

    // PWA (transparent)
    fs.writeFileSync(path.join(webPublicDir, 'pwa-192.png'), await renderFull(192));
    fs.writeFileSync(path.join(webPublicDir, 'pwa-512.png'), await renderFull(512));
    fs.writeFileSync(path.join(webPublicDir, 'logo-dark-192x192.png'), await renderFull(192));
    fs.writeFileSync(path.join(webPublicDir, 'logo-light-192x192.png'), await renderFull(192));

    // Apple Touch & Maskable (solid white bg)
    fs.writeFileSync(path.join(webPublicDir, 'apple-touch-icon-120x120.png'), await renderSolid(120));
    fs.writeFileSync(path.join(webPublicDir, 'apple-touch-icon-152x152.png'), await renderSolid(152));
    fs.writeFileSync(path.join(webPublicDir, 'apple-touch-icon-167x167.png'), await renderSolid(167));
    fs.writeFileSync(path.join(webPublicDir, 'apple-touch-icon-180x180.png'), await renderSolid(180));
    fs.writeFileSync(path.join(webPublicDir, 'apple-touch-icon.png'), await renderSolid(180));
    
    fs.writeFileSync(path.join(webPublicDir, 'pwa-maskable-192.png'), await renderSolid(192));
    fs.writeFileSync(path.join(webPublicDir, 'pwa-maskable-512.png'), await renderSolid(512));
    
    console.log('[gen-icons] updated web/public icons successfully.');
  }

  console.log('[gen-icons] note: macOS .icns is generated separately by generate-macos-icon-assets.cjs (mac builds only).');
};

main().catch((err) => {
  console.error('[gen-icons] failed:', err);
  process.exit(1);
});
