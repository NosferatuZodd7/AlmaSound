import { app } from 'electron';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeChannel, resolveRepository } from '../src/core/updates/releases';
import { THEMES, type AppSettings, type Theme } from './ipc';

const file = () => join(app.getPath('userData'), 'settings.json');

/** On disk, the repository is stored with the compiled default in force when it was saved. */
interface StoredSettings extends AppSettings {
  updateRepositoryDefault: string;
}

/**
 * The update repository compiled into this build (CI sets it to the repository it runs in).
 * Empty in local builds: the app then says the repository is not set instead of guessing one.
 */
export function compiledRepository(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as { almasound?: { updateRepository?: unknown } };
    const repo = pkg.almasound?.updateRepository;
    return typeof repo === 'string' ? repo : '';
  } catch {
    return '';
  }
}

export function loadSettings(): AppSettings {
  const compiled = compiledRepository();
  let raw: Partial<StoredSettings> = {};
  try {
    raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<StoredSettings>;
  } catch {
    // first run, or an unreadable file: start from defaults
  }
  return {
    language: typeof raw.language === 'string' ? raw.language : null,
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : 'system',
    checkForUpdates: raw.checkForUpdates !== false,
    updateChannel: normalizeChannel(raw.updateChannel),
    updateRepository: resolveRepository(
      typeof raw.updateRepository === 'string' ? raw.updateRepository : undefined,
      typeof raw.updateRepositoryDefault === 'string' ? raw.updateRepositoryDefault : undefined,
      compiled,
    ),
  };
}

export function saveSettings(settings: AppSettings): void {
  const stored: StoredSettings = { ...settings, updateRepositoryDefault: compiledRepository() };
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(stored, null, 2));
  renameSync(tmp, file()); // atomic replace, so a crash never leaves half a file
}
