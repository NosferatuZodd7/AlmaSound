# AlmaSound

Windows desktop app to compose music from chord progressions, shown as glowing voice lines that glide in time.

- Brief: [docs/BRIEF.md](docs/BRIEF.md)
- Reference web prototype: [docs/prototype/linhas-de-acordes.html](docs/prototype/linhas-de-acordes.html)

## Status

| Phase | State |
| --- | --- |
| 1 — Core (parser, voicing, timeline, stage, playback, editing, undo/redo, zoom, language setting) | done; awaiting owner review |
| 2 — Tracks and sampled instruments | not started |
| 3 — Imported audio and recording | not started |
| 4 — Projects and export | not started |
| 5 — Windows installer and portable build | done early (CI builds both); release flow and in-app updates in place |

Phase 1 plays a **placeholder synthesized piano**; sampled instruments arrive in Phase 2.

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev          # app with hot reload
npm run typecheck
npm test             # unit tests (Vitest)
npm run test:e2e     # builds, then drives the real Electron app with Playwright
```

On Linux without a display, run the end-to-end tests under a virtual one:
`xvfb-run -a -s "-screen 0 1280x800x24" npm run test:e2e`.

## Releases and updates

[.github/workflows/release.yml](.github/workflows/release.yml) runs on a Windows runner: typecheck, unit
tests, end-to-end tests against the real app on Windows, electron-builder, then a GitHub Release.

| Event | Result |
| --- | --- |
| push to `main` | **testing build**: prerelease `v{package.json version}-dev.{run number}` |
| push of a tag `vX.Y.Z` (must equal `package.json`'s version) | **stable** release `vX.Y.Z` |
| manual run with a version / without | stable / testing build of the chosen branch |
| changes only in `docs/**` or `*.md` | ignored |

- **Download:** GitHub → Releases. `AlmaSound-<version>-setup.exe` (installer, English/Portuguese, per-user,
  no administrator rights) or `AlmaSound-<version>-portable.exe` (no installation). Each file has a `.sha256`,
  and the hashes are also listed in the release text.
- The builds are **not code-signed**: Windows SmartScreen warns on first run (*More info → Run anyway*).
- **Publishing a stable version:** bump `version` in `package.json`, commit, then push the tag `vX.Y.Z`.
  Old `-dev.N` builds of that version are removed; testing builds keep the 5 newest.
- **Version and repository are not in the source:** CI passes them to electron-builder
  (`extraMetadata.version`, `extraMetadata.almasound.updateRepository = github.repository`). A local build
  says "update repository not set" instead of querying someone else's.
- To build locally on Windows: `npm ci && npm run build && npx electron-builder --win --x64`; output in `dist/`.
- The app icon is built from the logo by `python3 tools/make_icon.py` (Pillow) into `build/`.

### In-app updates

Settings → Updates (also Help → Check for updates…):
- **Automatic check** at startup (about 6 s after the window opens; silent unless there is a new version).
  Off means the app never goes online for updates.
- **Channel:** *Stable* sees final releases only; *Testing* also sees the `-dev.N` builds.
- **Repository** (`owner/name`), editable; a value the user never changed follows the build's default.
- The app reads the public GitHub API **anonymously** (no token). **The repository must be public** for
  installed copies to see releases; a private one answers 404 ("private, or the name is wrong").
- **Install now** downloads the `-setup.exe`, checks it against the published SHA-256 (from the release text,
  or the `.sha256` file), deletes it on a mismatch, then starts the installer and closes AlmaSound. Nothing
  is ever installed without that click. "Later" only hides the dialog.
- Demo without publishing anything: run the app with `ALMASOUND_UPDATE_DEMO=1`.
- Not done yet (next steps): code signing, and a signature checked against a key embedded in the app (the
  SHA-256 lives in the same release, so it guards against corruption, not a compromised repository).

## Logging and diagnostics

A bug report should say which step stopped, after how long, what the other side answered and in what
environment — collected automatically and safe to paste in public.

- **Log file:** `%APPDATA%\AlmaSound\logs\almasound.log` (falls back to the exe folder, then `%TEMP%`),
  UTC timestamps with milliseconds, flushed per line, rotated at 5 MB × 5 files. Levels Debug/Info/Warning/Error;
  Info by default, *Debug logging* in the Diagnostics window for chasing a bug. Each line starts with its
  module (`Startup:`, `Updates:`, `Audio:`, `Renderer:`, `Settings:`, `Diagnostics:`).
- **Redaction:** every line, the report and the clipboard pass through `redactSensitive` (passwords, tokens,
  keys, authorization headers…); secret settings are never printed.
- **Startup breadcrumbs** and a `──── startup ────` separator per start. The window's own warnings and
  errors (React, uncaught exceptions) are logged as `Renderer:`. Bursts of the same message collapse into
  "… N more like this".
- **Startup guard:** `startup.lock` is written before the window and removed when the first frame is drawn.
  If it is still there on the next start, AlmaSound starts with software rendering and logs why; forced
  with `--software` or `ALMASOUND_SOFTWARE`. If no frame appears within 20 s, a clear message says what to do.
- **Crashes:** native crashes leave a minidump in the `Crashpad` folder (never uploaded); a crashed window
  offers Reload/Quit; uncaught errors in the main process are logged as `FATAL` and shown with the log path.
- **Step traces:** the last update check and the last install are recorded step by step with timings and the
  likely cause of a failure.
- **Diagnostics window** (Help → Diagnostics, Ctrl+L): live log with filter, errors-only, follow-the-end and
  debug switches; *Copy report*, *Save to…* and *Save to desktop*
  (`AlmaSound-diagnostics-YYYY-MM-DD-HHMMSS.txt`); the log path in the footer.
- **Report:** versions (app, Electron, Chromium, OS, rendering, GPU), network interfaces, audio facts (context
  state, sample rate, latencies, output devices, transport), updates, settings, last attempts, files, the last
  log lines, and `-- end of diagnostics --`. Headless: `--print-diagnostics` (stdout) or `--print-diagnostics=<file>` (appends to a file; use this on Windows, where the GUI exe has no stdout).
- **When the app does not even open:** run `diagnostics.bat` (next to `AlmaSound.exe`, also in the Start menu).
  It writes `diagnostics.txt` with the app's report in software mode, the app run in compatibility mode, the
  log tail and recent crashes from the Windows Application log. CI runs it on every Windows build.
- Not done from the design: a separate framework log file (the renderer's messages go to the same log with a
  `Renderer:` prefix), attaching a parent console on Windows, and the installation-consistency check (the
  app ships as one archive, so files cannot be half-replaced).

## Layout

```
electron/        main process: window, native menu, settings file, IPC contract, preload
src/core/        music theory and timeline (pure TypeScript, no UI or audio)
src/audio/       audio engine (lookahead scheduler) and instruments
src/ui/          React components and the canvas stage
src/i18n/        i18next setup, locale discovery, Intl formatting
locales/         one JSON per language (en is the reference)
tests/unit/      Vitest
tests/e2e/       Playwright against the built Electron app
```

## Adding a language

Copy `locales/en.json` to `locales/<code>.json` (e.g. `fr.json`, `pt-BR.json`), set `_meta.name` to the
language's own name and translate the values. It appears in Settings → Language after the next build;
missing keys show the English text. No code changes are needed.

## Decisions

Recorded here as the brief asks: when several paths were reasonable, the simplest was chosen.

- **Electron, not Tauri.** On Windows, Tauri also renders with Chromium (WebView2), so there is no audio or
  canvas gain; Electron pins one Chromium version for every PC and makes bundling ffmpeg easy.
- **electron-vite** builds main, preload and renderer with one config.
- **No Tone.js.** A small lookahead scheduler on the Web Audio clock. Playback and (Phase 4) offline export
  share the same note list (`noteEvents`) and instrument code, so the export sounds like playback.
- **Visuals follow the audio clock** (`AudioContext.currentTime` minus output latency), not a separate timer.
- **Notes depend only on the progression text.** Changing the BPM rescales time and keeps hand edits;
  changing the text regenerates the voices and asks first if there are hand edits (undo brings them back).
- **Undo/redo** covers note edits and progression changes; one drag is one undo step. BPM and zoom are not
  part of the history.
- **Shortcuts** are handled in one place, the renderer; the native menu only displays them. In a text field,
  Ctrl+Z undoes the text and Space types a space.
- **Languages are bundled at build time** from `locales/*.json`.
- **Settings** (language, theme, updates, debug logging) live in `settings.json` in the app's user-data folder, written atomically.
- **Project file extension:** `.alma` (Phase 4).
- **Input modes:** *Simple* (default) needs no music theory: pick a key, click its seven chords (they play
  and are added), or start from a well-known progression; chips show each chord, its length (click to cycle
  4 → 2 → 1 → 8 beats) and remove it. *Full* is the text field. Both edit the same progression text; the
  choice is remembered (localStorage).
- **Transition between notes:** *Smooth* (default) plays each voice as one continuous note that glides with
  the line (same cosine curve, via Web Audio value curves) and is softly re-accented at each chord change;
  *Instant* re-strikes every chord and the lines step. Not in the undo history, like BPM.
- **Logo:** owner-provided artwork in `assets/logo-source.webp`; `python3 tools/make_icon.py` builds the app
  icon and the top-bar mark from it.
- **Minimum window:** 720 × 640, so the stage stays usable with the simple editor open.
- **Fonts:** SF Pro where the OS has it, otherwise Segoe UI Variable / Segoe UI on Windows; nothing is
  downloaded or bundled (SF Pro's licence does not allow bundling it in a Windows app).

## Design system: Liquid Glass

The UI follows Apple's Liquid Glass language (iOS 26 / macOS Tahoe), in light and dark themes.

- **Tokens** live at the top of `src/ui/styles.css`: typography, spacing, concentric radii, motion, glass
  material (fill, blur, saturation, rim, sheen, shadows), content colours, background and the stage
  colours. Dark values override them under `prefers-color-scheme: dark`.
- **Theme** (System / Light / Dark, in Settings) is stored in `settings.json` and applied through Electron's
  `nativeTheme`, which drives `prefers-color-scheme` and also themes native menus and dialogs. The canvas
  reads its colours from the same tokens and redraws when the scheme changes.
- **Material:** `.glass` = translucent fill + `backdrop-filter: blur() saturate()` + a gradient rim drawn
  with a masked `::before` + a specular sheen `::after`. Without `backdrop-filter` it falls back to an opaque fill.
- **Components:** `.glass` surfaces, `IconButton` (round buttons with a tooltip showing the shortcut),
  `.btn-primary`, `.input`, `.select` (glass picker via Chromium's customizable select), `Segmented`
  (native radios), `.badge`, `[data-tip]` tooltips, `.dialog` (enter/exit transitions).
- **Layout:** the stage fills the window; the top bar, chord card and dock float above it, so the glass
  blurs the moving lines behind it. The stage keeps notes clear of the panels (measured insets).
- **Motion** is short and eased; everything honours `prefers-reduced-motion`.
- Real refraction (SVG displacement in `backdrop-filter`) was left out: it would be recomputed every frame
  over the animated stage, against the 60 fps goal.
