import { app } from 'electron';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { AppSettings } from './ipc';

const file = () => join(app.getPath('userData'), 'settings.json');

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<AppSettings>;
    return { language: typeof raw.language === 'string' ? raw.language : null };
  } catch {
    return { language: null }; // first run, or an unreadable file: start from defaults
  }
}

export function saveSettings(settings: AppSettings): void {
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2));
  renameSync(tmp, file()); // atomic replace, so a crash never leaves half a file
}
