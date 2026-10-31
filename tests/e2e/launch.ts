import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  /** Errors logged by the renderer; tests expect none. */
  errors: string[];
}

/** Starts the built app (npm run test:e2e builds it first) with fresh settings. On Linux it needs a display (xvfb-run). */
export async function launchApp(env: Record<string, string> = {}): Promise<Launched> {
  const app = await electron.launch({
    colorScheme: null, // no emulation: the app's nativeTheme must drive prefers-color-scheme
    // The project folder, not out/main/main.js: Electron then reads package.json (name, version).
    args: ['--no-sandbox', join(import.meta.dirname, '../..')],
    env: { ...process.env, ALMASOUND_USER_DATA: mkdtempSync(join(tmpdir(), 'almasound-e2e-')), LANG: 'en_US.UTF-8', ...env },
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1280, height: 760 });
  return { app, page, errors };
}
