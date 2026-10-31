import { app, BrowserWindow, clipboard, crashReporter, dialog, ipcMain, Menu, nativeTheme } from 'electron';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createI18n, LOCALES, resolveLanguage } from '../src/i18n/locales';
import { normalizeChannel } from '../src/core/updates/releases';
import { buildReport, saveReport, type DiagnosticsContext } from './diagnostics';
import { CHANNELS, LOG_LEVELS, THEMES, type ConfirmOptions, type LogLevel, type ReportTarget, type Theme, type UpdateSettings } from './ipc';
import { log } from './logger';
import { buildMenu } from './menu';
import { loadSettings, saveSettings, settingsFile } from './settings';
import { Updater } from './updater';

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
const printDiagnostics = process.argv.includes('--print-diagnostics');
// Lets automated tests run with fresh settings without touching the real profile.
if (process.env.ALMASOUND_USER_DATA) app.setPath('userData', process.env.ALMASOUND_USER_DATA);

// Logging first, so every later step leaves a breadcrumb.
if (printDiagnostics) log.toConsole = false; // stdout carries only the report
log.attachFile([join(app.getPath('userData'), 'logs'), dirname(process.execPath), tmpdir()]);
log.info(`──── startup ──── AlmaSound ${app.getVersion()}, Electron ${process.versions.electron}, ${process.platform} ${process.arch}`);
log.info('Startup: reading settings');
let settings = loadSettings();
log.level = settings.debugLogging ? 'debug' : 'info';
nativeTheme.themeSource = settings.theme;
const currentLanguage = () => resolveLanguage(settings.language ?? app.getLocale());
const t = () => createI18n(currentLanguage()).t;
const STARTUP_CHECK_DELAY_MS = 6000; // after the window opens, so it does not compete with startup
const FIRST_FRAME_TIMEOUT_MS = 20_000;

// Native crashes leave a minidump next to the data (never uploaded).
crashReporter.start({ uploadToServer: false });
log.info(`Startup: crash dumps go to ${app.getPath('crashDumps')}`);

// Startup guard: the marker is removed when the first frame is drawn. If it is still there, the
// previous start never showed anything, so this one uses software rendering.
const startupLock = join(app.getPath('userData'), 'startup.lock');
const safeMode = existsSync(startupLock)
  ? 'the previous start never drew a window'
  : process.argv.includes('--software')
    ? '--software'
    : process.env.ALMASOUND_SOFTWARE
      ? 'ALMASOUND_SOFTWARE is set'
      : null;
if (safeMode) {
  app.disableHardwareAcceleration();
  log.warn(`Startup: software rendering, because ${safeMode}`);
}
let firstFrameSeen = false;

/** One path for fatal errors: logged as FATAL, then shown with the log's location. */
function reportFatal(title: string, message: string): void {
  log.error(`FATAL: ${title}: ${message}`);
  if (printDiagnostics) return;
  dialog.showErrorBox(title, `${message}\n\n${t()('fatal.logAt', { path: log.path ?? '-' })}`);
}

process.on('uncaughtException', (e) => reportFatal(t()('fatal.errorTitle'), e.stack ?? String(e)));
process.on('unhandledRejection', (e) => log.error(`Main: unhandled promise rejection: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`));
app.on('child-process-gone', (_e, d) => log.warn(`Main: ${d.type} process gone (${d.reason}, exit code ${d.exitCode})${d.name ? `, ${d.name}` : ''}`));

const updater = new Updater(
  () => ({ repository: settings.updateRepository, channel: settings.updateChannel }),
  (status, notify) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(CHANNELS.updateStatus, status, notify);
  },
);

const diagnostics: DiagnosticsContext = {
  settings: () => settings,
  settingsPath: settingsFile(),
  updateStatus: () => updater.status,
  traces: updater.traces,
  safeMode,
};

function createWindow(): BrowserWindow {
  log.info('Startup: creating the window');
  const i18n = createI18n(currentLanguage());
  try {
    writeFileSync(startupLock, new Date().toISOString());
  } catch (e) {
    log.warn(`Startup: could not write ${startupLock}: ${String(e)}`);
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 640,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0f1a' : '#eef1f8',
    title: i18n.t('app.title'),
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false, // keep the audio scheduler running when the window is hidden
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  Menu.setApplicationMenu(buildMenu(i18n.t, win, isDev));
  const wc = win.webContents;

  // The renderer's own warnings and errors (React, uncaught exceptions) land in the app log.
  wc.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') log.log(e.level === 'error' ? 'error' : 'warn', `Renderer: ${e.message} (${e.sourceId}:${e.lineNumber})`);
  });
  wc.on('did-fail-load', (_e, code, description, url) => reportFatal(t()('fatal.loadTitle'), `${description} (${code}) ${url}`));
  wc.on('unresponsive', () => log.warn('Renderer: the window stopped responding'));
  wc.on('responsive', () => log.info('Renderer: the window responds again'));
  wc.on('render-process-gone', (_e, d) => {
    log.error(`FATAL: the window's process ended (${d.reason}, exit code ${d.exitCode})`);
    if (d.reason === 'clean-exit') return;
    const tr = t();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'error',
      message: tr('fatal.crashTitle'),
      detail: tr('fatal.crashDetail', { path: log.path ?? '-' }),
      buttons: [tr('fatal.reload'), tr('fatal.quit')],
      defaultId: 0,
      noLink: true,
    });
    if (choice === 0) wc.reload();
    else app.quit();
  });

  win.once('ready-to-show', () => {
    log.info('Startup: window ready, showing it');
    win.show();
    // Demo mode shows the update dialog without publishing anything (screenshots, tests).
    if (process.env.ALMASOUND_UPDATE_DEMO === '1') setTimeout(() => updater.demo(), 500);
    else if (settings.checkForUpdates) setTimeout(() => void updater.check(false), STARTUP_CHECK_DELAY_MS);
  });
  setTimeout(() => {
    if (firstFrameSeen || win.isDestroyed()) return;
    const tr = t();
    reportFatal(tr('fatal.noWindowTitle'), safeMode ? tr('fatal.noWindowSafe') : tr('fatal.noWindow'));
  }, FIRST_FRAME_TIMEOUT_MS);

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return win;
}

ipcMain.handle(CHANNELS.getSettings, () => ({ ...settings, systemLanguage: app.getLocale() }));

ipcMain.handle(CHANNELS.setLanguage, (event, language: unknown) => {
  if (typeof language !== 'string' || !LOCALES.some((l) => l.code === language)) return;
  settings = { ...settings, language };
  saveSettings(settings);
  log.info(`Settings: language ${language}`);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) Menu.setApplicationMenu(buildMenu(createI18n(language).t, win, isDev));
});

ipcMain.handle(CHANNELS.setTheme, (_event, theme: unknown) => {
  if (!THEMES.includes(theme as Theme)) return;
  settings = { ...settings, theme: theme as Theme };
  saveSettings(settings);
  log.info(`Settings: theme ${settings.theme}`);
  nativeTheme.themeSource = settings.theme;
});

ipcMain.handle(CHANNELS.setUpdateSettings, (_event, patch: Partial<UpdateSettings>) => {
  if (!patch || typeof patch !== 'object') return;
  const next = { ...settings };
  if (typeof patch.checkForUpdates === 'boolean') next.checkForUpdates = patch.checkForUpdates;
  if (patch.updateChannel !== undefined) next.updateChannel = normalizeChannel(patch.updateChannel);
  if (typeof patch.updateRepository === 'string') next.updateRepository = patch.updateRepository.trim();
  settings = next;
  saveSettings(settings);
  log.info(`Settings: updates auto=${settings.checkForUpdates}, channel=${settings.updateChannel}, repository=${settings.updateRepository || '(not set)'}`);
});

ipcMain.handle(CHANNELS.setDebugLogging, (_event, on: unknown) => {
  settings = { ...settings, debugLogging: on === true };
  saveSettings(settings);
  log.level = settings.debugLogging ? 'debug' : 'info';
  log.info(`Settings: debug logging ${settings.debugLogging ? 'on' : 'off'}`);
});

ipcMain.handle(CHANNELS.getUpdateStatus, () => updater.status);
ipcMain.handle(CHANNELS.checkForUpdates, () => updater.check(true));
ipcMain.handle(CHANNELS.installUpdate, () => updater.install());
ipcMain.handle(CHANNELS.openUpdatePage, () => updater.openPage());

ipcMain.handle(CHANNELS.confirm, async (event, o: ConfirmOptions) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = { type: 'question' as const, message: String(o.message), detail: String(o.detail), buttons: [String(o.confirm), String(o.cancel)], defaultId: 1, cancelId: 1, noLink: true };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  return response === 0;
});

// Logging and diagnostics
ipcMain.on(CHANNELS.log, (_event, level: unknown, message: unknown) => {
  if (LOG_LEVELS.includes(level as LogLevel) && typeof message === 'string') log.log(level as LogLevel, message.slice(0, 4000));
});
ipcMain.handle(CHANNELS.getLog, () => ({ lines: log.lines(), path: log.path }));
log.onLine((line) => {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(CHANNELS.logLine, line);
});
ipcMain.on(CHANNELS.firstFrame, () => {
  if (firstFrameSeen) return;
  firstFrameSeen = true;
  log.info(`Startup: first frame drawn after ${Math.round(process.uptime() * 1000)} ms`);
  try {
    unlinkSync(startupLock);
  } catch {
    // already gone
  }
});
ipcMain.handle(CHANNELS.saveDiagnostics, async (event, target: ReportTarget, audio: unknown) => {
  const lines = Array.isArray(audio) ? audio.filter((l): l is string => typeof l === 'string') : null;
  const report = buildReport(diagnostics, lines);
  if (target === 'copy') {
    clipboard.writeText(report);
    log.info('Diagnostics: report copied to the clipboard');
    return {};
  }
  try {
    if (target === 'desktop') return { path: saveReport(report, app.getPath('desktop')) };
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = { defaultPath: join(app.getPath('documents'), 'AlmaSound-diagnostics.txt'), filters: [{ name: 'Text', extensions: ['txt'] }] };
    const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (r.canceled || !r.filePath) return { cancelled: true };
    writeFileSync(r.filePath, report);
    log.info(`Diagnostics: report saved to ${r.filePath}`);
    return { path: r.filePath };
  } catch (e) {
    log.error(`Diagnostics: could not save the report: ${String(e)}`);
    return { error: String(e) };
  }
});

app.whenReady().then(() => {
  log.info('Startup: Electron ready');
  if (printDiagnostics) {
    // Headless report (used by diagnostics.bat when the window cannot open).
    process.stdout.write(buildReport(diagnostics, null), () => app.exit(0));
    return;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => log.info('Main: quitting'));
