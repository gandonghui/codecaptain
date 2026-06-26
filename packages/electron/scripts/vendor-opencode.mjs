// Copies the standalone `opencode` CLI binary into packages/electron/resources/opencode
// so it ships inside the installer. Runs as part of the desktop `package` script.
//
// Source resolution order (first existing wins):
//   1. --source <path> CLI arg
//   2. CODECAPTAIN_OPENCODE_SOURCE env var
//   3. The platform's standard opencode install location:
//        Windows: %USERPROFILE%\.opencode\bin\opencode.exe (then .cmd)
//        macOS/Linux: ~/.opencode/bin/opencode, ~/.bun/bin/opencode, /usr/local/bin/opencode
//
// The source may be a single binary file OR a directory (the whole directory is
// copied — useful when opencode ships alongside helper files). If nothing is
// found and the destination already holds a binary, the existing one is kept.
//
// Set CODECAPTAIN_REQUIRE_BUNDLED_OPENCODE=1 (or pass --require) to hard-fail the
// build when no opencode binary can be staged — recommended for release builds
// that must be self-contained for offline use.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(__dirname, '..');
const destDir = path.join(electronRoot, 'resources', 'opencode');
const isWin = process.platform === 'win32';
const binName = isWin ? 'opencode.exe' : 'opencode';

const argv = process.argv.slice(2);
const getArg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const requireBundled =
  argv.includes('--require') || process.env.CODECAPTAIN_REQUIRE_BUNDLED_OPENCODE === '1';

const isExecutableFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const resolveSource = () => {
  const explicit = [getArg('--source'), process.env.CODECAPTAIN_OPENCODE_SOURCE]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  for (const candidate of explicit) {
    if (fs.existsSync(candidate)) return candidate;
    console.warn(`[vendor-opencode] configured source not found: ${candidate}`);
  }

  const home = os.homedir();
  const userProfile = process.env.USERPROFILE || home;
  const candidates = isWin
    ? [
        path.join(userProfile, '.opencode', 'bin', 'opencode.exe'),
        path.join(userProfile, '.opencode', 'bin', 'opencode.cmd'),
        path.join(userProfile, '.bun', 'bin', 'opencode.exe'),
        process.env.LOCALAPPDATA
          ? path.join(process.env.LOCALAPPDATA, 'Programs', 'opencode', 'opencode.exe')
          : '',
      ]
    : [
        path.join(home, '.opencode', 'bin', 'opencode'),
        path.join(home, '.bun', 'bin', 'opencode'),
        '/opt/homebrew/bin/opencode',
        '/usr/local/bin/opencode',
        '/usr/bin/opencode',
      ];

  return candidates.filter(Boolean).find((c) => fs.existsSync(c)) || null;
};

const destHasBinary = () => {
  try {
    return fs.readdirSync(destDir).some((f) => f === binName || f.toLowerCase().startsWith('opencode'));
  } catch {
    return false;
  }
};

fs.mkdirSync(destDir, { recursive: true });

const source = resolveSource();

if (!source) {
  if (destHasBinary()) {
    console.log('[vendor-opencode] no source found; keeping existing bundled binary.');
    process.exit(0);
  }
  const msg =
    '[vendor-opencode] No opencode CLI found to bundle. Install opencode (so it lives at ' +
    `${isWin ? '%USERPROFILE%\\.opencode\\bin\\opencode.exe' : '~/.opencode/bin/opencode'}) ` +
    'or pass --source <path> / set CODECAPTAIN_OPENCODE_SOURCE.';
  if (requireBundled) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg}\n[vendor-opencode] Continuing without a bundled opencode (installer will rely on system PATH).`);
  process.exit(0);
}

const stat = fs.statSync(source);
if (stat.isDirectory()) {
  // Copy the whole directory contents into destDir.
  fs.cpSync(source, destDir, { recursive: true });
  console.log(`[vendor-opencode] copied directory ${source} -> ${destDir}`);
} else {
  const dest = path.join(destDir, binName);
  fs.copyFileSync(source, dest);
  if (!isWin) {
    try {
      fs.chmodSync(dest, 0o755);
    } catch {}
  }
  console.log(`[vendor-opencode] copied ${source} -> ${dest}`);
}

if (!isWin) {
  // best-effort: ensure any copied opencode binary is executable
  try {
    for (const f of fs.readdirSync(destDir)) {
      if (f === binName) fs.chmodSync(path.join(destDir, f), 0o755);
    }
  } catch {}
}

// Sanity check.
const finalBin = path.join(destDir, binName);
if (isExecutableFile(finalBin)) {
  console.log(`[vendor-opencode] bundled opencode ready: ${finalBin}`);
} else if (!destHasBinary()) {
  console.warn('[vendor-opencode] warning: no opencode binary present in resources/opencode after vendoring.');
}
