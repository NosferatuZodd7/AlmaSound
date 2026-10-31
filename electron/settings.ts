import { app } from 'electron';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES, type AppSettings, type Theme } from './ipc';

const file = () => join(app.getPath('userData'), 'settings.json');

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<AppSettings>;
    return {
      language: typeof raw.language === 'string' ? raw.language : null,
      theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : 'system',
    };
  } catch {
    return { language: null, theme: 'system' }; // first run, or an unreadable file: start from defaults
  }
}

export function saveSettings(settings: AppSettings): void {
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2));
  renameSync(tmp, file()); // atomic replace, so a crash never leaves half a file
}
