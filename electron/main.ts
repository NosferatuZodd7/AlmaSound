import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } from 'electron';
import { join } from 'node:path';
import { createI18n, LOCALES, resolveLanguage } from '../src/i18n/locales';
import { normalizeChannel } from '../src/core/updates/releases';
import { CHANNELS, THEMES, type ConfirmOptions, type Theme, type UpdateSettings } from './ipc';
import { buildMenu } from './menu';
import { loadSettings, saveSettings } from './settings';
import { Updater } from './updater';

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
// Lets automated tests run with fresh settings without touching the real profile.
if (process.env.ALMASOUND_USER_DATA) app.setPath('userData', process.env.ALMASOUND_USER_DATA);
let settings = loadSettings();
nativeTheme.themeSource = settings.theme;
const currentLanguage = () => resolveLanguage(settings.language ?? app.getLocale());
const STARTUP_CHECK_DELAY_MS = 6000; // after the window opens, so it does not compete with startup

const updater = new Updater(
  () => ({ repository: settings.updateRepository, channel: settings.updateChannel }),
  (status, notify) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(CHANNELS.updateStatus, status, notify);
  },
);

function createWindow(): BrowserWindow {
  const i18n = createI18n(currentLanguage());
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
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
  win.once('ready-to-show', () => {
    win.show();
    // Demo mode shows the update dialog without publishing anything (screenshots, tests).
    if (process.env.ALMASOUND_UPDATE_DEMO === '1') setTimeout(() => updater.demo(), 500);
    else if (settings.checkForUpdates) setTimeout(() => void updater.check(false), STARTUP_CHECK_DELAY_MS);
  });
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return win;
}

ipcMain.handle(CHANNELS.getSettings, () => ({ ...settings, systemLanguage: app.getLocale() }));

ipcMain.handle(CHANNELS.setLanguage, (event, language: unknown) => {
  if (typeof language !== 'string' || !LOCALES.some((l) => l.code === language)) return;
  settings = { ...settings, language };
  saveSettings(settings);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) Menu.setApplicationMenu(buildMenu(createI18n(language).t, win, isDev));
});

ipcMain.handle(CHANNELS.setTheme, (_event, theme: unknown) => {
  if (!THEMES.includes(theme as Theme)) return;
  settings = { ...settings, theme: theme as Theme };
  saveSettings(settings);
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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
