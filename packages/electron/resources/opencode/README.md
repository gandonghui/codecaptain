# Bundled opencode CLI

This folder is **auto-populated at build time** by `scripts/vendor-opencode.mjs`
(run as part of `bun run --cwd packages/electron package`).

The vendor script copies the standalone `opencode` CLI binary here so it ships
inside the installer. At runtime, `main.mjs` detects
`resources/opencode/opencode.exe` (or `opencode` on macOS/Linux) and points
`OPENCHAMBER_OPENCODE_BIN` at it, so the packaged desktop app works fully
offline / out-of-the-box without a separately installed opencode on PATH.

Do not hand-edit binaries here; let the vendor script manage them. Keep this
README so the directory exists even before the first vendor run (electron-builder
requires the `from` directory of an `extraResources` entry to exist).
