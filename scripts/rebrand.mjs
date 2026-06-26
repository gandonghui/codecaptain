#!/usr/bin/env node
/*
 * Rebrand script.
 *
 *   openchamber  ->  CodeCaptain        (FULL rename: UI, env vars, package scope,
 *                                        appId, file/dir names, docs - it's our code)
 *   opencode     ->  CodeCaptain-core   (DISPLAY TEXT ONLY: docs + i18n message values)
 *
 * The opencode CLI/SDK technical contracts are intentionally left untouched so the
 * app keeps working with the real opencode tool:
 *   - the `@opencode-ai/sdk` import
 *   - the `opencode` / `opencode.exe` / `opencode.cmd` binary names
 *   - the `.opencode` config directory convention
 *   - the `OPENCODE_*` environment variables (read by the opencode CLI itself)
 *   - any `OpenCode` JavaScript identifiers (function/component/type names) - a
 *     hyphenated "CodeCaptain-core" cannot be a valid identifier anyway.
 *
 * Usage (run from the repo root):
 *   node scripts/rebrand.mjs --dry     # preview: list files that would change + renames
 *   node scripts/rebrand.mjs           # apply
 *
 * After applying:
 *   bun install            # regenerate the lockfile for the renamed @codecaptain/* scope
 *   bun run type-check     # catch anything that needs a manual touch
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

const EXCLUDE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'dist-bundle', 'build', 'out',
  'coverage', '.turbo', '.next', '.electron-gyp', '.cache',
]);

const EXCLUDE_FRAGMENTS = [
  path.join('resources', 'web-dist'),
  path.join('resources', 'opencode'),
];

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.json5',
  '.md', '.mdx', '.txt',
  '.yml', '.yaml', '.toml',
  '.html', '.css', '.scss',
  '.sh', '.ps1', '.bat', '.cmd',
  '.env',
]);

const TEXT_BASENAMES = new Set([
  '.gitignore', '.npmrc', '.gitattributes', 'Dockerfile', 'AGENTS.md', 'CLAUDE.md',
]);

const EXCLUDE_BASENAMES = new Set([
  'bun.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'rebrand.mjs',
]);

// openchamber -> CodeCaptain (order matters)
const OPENCHAMBER_RULES = [
  [/OPENCHAMBER_/g, 'CODECAPTAIN_'],
  [/@openchamber\//g, '@codecaptain/'],
  [/openchamber-monorepo/g, 'codecaptain-monorepo'],
  [/dev\.openchamber\.desktop/g, 'dev.codecaptain.desktop'],
  [/OpenChamber/g, 'CodeCaptain'],
  [/openchamber/g, 'codecaptain'],
  [/1\.13\.3/g, '0.1.0'],
];

// opencode -> CodeCaptain-core (DISPLAY ONLY). The PascalCase brand token only.
// Applied whole-file to docs (.md/.mdx), where "OpenCode" is always prose.
const OPENCODE_DISPLAY_RULES = [
  [/OpenCode/g, 'CodeCaptain-core'],
];

// Hard-coded user-visible "OpenCode" strings inside code files (.ts/.tsx) that are
// NOT covered by i18n. Each pattern carries enough surrounding context that it can
// never match a JS identifier (component/hook/function/store names, imports) or an
// i18n key like t('...reloadOpenCode'). Keep this list as the single source of
// truth: when upstream adds/changes such a string, adjust a rule here and re-run.
// (Re-running is idempotent — once replaced, the pattern no longer matches.)
const OPENCODE_CODE_DISPLAY_RULES = [
  [/before OpenCode could send the next message/g, 'before CodeCaptain-core could send the next message'],
  [/deleted, but OpenCode reload failed/g, 'deleted, but CodeCaptain-core reload failed'],
  [/Restarting OpenCode/g, 'Restarting CodeCaptain-core'],
  [/>(\s*)OpenCode(\s*)<\/span>/g, '>$1CodeCaptain-core$2</span>'],
];

const toPosix = (rel) => rel.split(path.sep).join('/');
const isDocFile = (rel) => /\.(md|mdx)$/i.test(rel);
const isI18nMessageFile = (rel) => toPosix(rel).includes('lib/i18n/messages');

// In i18n message files, "OpenCode" appears in both translation KEYS (e.g.
// 'settings.actions.reloadOpenCode') and VALUES (the user-facing text). Renaming a
// key here would break the t('...') lookups in components (which we do not touch).
// So transform the VALUE side only: everything after the `'<key>':` separator.
const transformI18nDisplay = (text) =>
  text
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*:\s*)([\s\S]*)$/);
      if (!m) return line;
      return m[1] + m[2].replace(/OpenCode/g, 'CodeCaptain-core');
    })
    .join('\n');

const isTextFile = (full) => {
  const base = path.basename(full);
  if (EXCLUDE_BASENAMES.has(base)) return false;
  if (TEXT_BASENAMES.has(base)) return true;
  return TEXT_EXTS.has(path.extname(full).toLowerCase());
};

const isExcluded = (full) => {
  const rel = path.relative(ROOT, full);
  return EXCLUDE_FRAGMENTS.some((f) => rel.includes(f));
};

const applyRules = (text, rules) => {
  let out = text;
  for (const [re, to] of rules) out = out.replace(re, to);
  return out;
};

// Treat a file as binary if it contains a NUL byte. Uses charCodeAt so no
// control characters need to appear literally in this source.
const looksBinary = (text) => {
  const n = Math.min(text.length, 8000);
  for (let i = 0; i < n; i++) {
    if (text.charCodeAt(i) === 0) return true;
  }
  return false;
};

const allFiles = [];
const allDirs = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (isExcluded(full)) continue;
      allDirs.push(full);
      walk(full);
    } else if (entry.isFile()) {
      const full = path.join(dir, entry.name);
      if (isExcluded(full)) continue;
      allFiles.push(full);
    }
  }
};
walk(ROOT);

// 1) Content edits.
let contentChanged = 0;
let displayChanged = 0;
for (const full of allFiles) {
  if (!isTextFile(full)) continue;
  let text;
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  if (looksBinary(text)) continue;

  let next = applyRules(text, OPENCHAMBER_RULES);
  const rel = path.relative(ROOT, full);
  if (isDocFile(rel)) {
    const afterDisplay = applyRules(next, OPENCODE_DISPLAY_RULES);
    if (afterDisplay !== next) displayChanged++;
    next = afterDisplay;
  } else if (isI18nMessageFile(rel)) {
    const afterDisplay = transformI18nDisplay(next);
    if (afterDisplay !== next) displayChanged++;
    next = afterDisplay;
  } else {
    const afterDisplay = applyRules(next, OPENCODE_CODE_DISPLAY_RULES);
    if (afterDisplay !== next) displayChanged++;
    next = afterDisplay;
  }

  if (next !== text) {
    contentChanged++;
    if (DRY) console.log(`edit   ${rel}`);
    else fs.writeFileSync(full, next);
  }
}

// 2) File + directory renames (openchamber-named paths only).
const renameTargets = [...allFiles, ...allDirs]
  .filter((full) => /openchamber/i.test(path.basename(full)))
  .sort((a, b) => b.length - a.length);

let renamed = 0;
for (const full of renameTargets) {
  const dir = path.dirname(full);
  const base = path.basename(full);
  const newBase = applyRules(base, OPENCHAMBER_RULES);
  if (newBase === base) continue;
  const dest = path.join(dir, newBase);
  renamed++;
  if (DRY) console.log(`rename ${path.relative(ROOT, full)}  ->  ${newBase}`);
  else fs.renameSync(full, dest);
}

console.log(
  `\n${DRY ? '[dry run] ' : ''}content edits: ${contentChanged} file(s)` +
  ` (display/opencode brand: ${displayChanged}), renames: ${renamed}`,
);
if (DRY) console.log('No files were modified. Re-run without --dry to apply.');
else console.log('Done. Next: `bun install` then `bun run type-check`.');
