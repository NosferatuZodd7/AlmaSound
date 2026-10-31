import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electronPath from 'electron';
import { launchApp } from './launch';

const END = '-- end of diagnostics --';

test('Ctrl+L shows the live log; the copied report has every section and no log noise', async () => {
  const { app, page, errors } = await launchApp();
  try {
    await page.getByTestId('stage').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+L');
    const view = page.getByTestId('log-view');
    await expect(view).toContainText('──── startup ────');
    await expect(view).toContainText('Startup: first frame drawn');
    await page.getByRole('searchbox', { name: 'Filter the log' }).fill('Startup:');
    for (const line of await view.locator('span').allTextContents()) expect(line).toContain('Startup:');
    await page.screenshot({ path: 'test-results/diagnostics.png' });

    await page.getByRole('button', { name: 'Copy report' }).click();
    await expect(page.getByTestId('diag-status')).toHaveText('Report copied to the clipboard.');
    const report = await app.evaluate(({ clipboard }) => clipboard.readText());
    for (const heading of ['Versions', 'Network', 'Audio', 'Updates', 'Settings', 'Last attempts', 'Files', 'Log (last lines)', END]) expect(report).toContain(heading);
    expect(report).toContain('Rendering: hardware');
    expect(report).toContain('Output devices:');
    expect(report).toContain('Update check');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('a start that never drew a window is followed by a safe-mode start', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'almasound-e2e-'));
  writeFileSync(join(userData, 'startup.lock'), 'left by a start that never drew');
  const { app, page } = await launchApp({ ALMASOUND_USER_DATA: userData });
  try {
    await page.getByTestId('stage').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+L');
    await expect(page.getByTestId('log-view')).toContainText('software rendering, because the previous start never drew a window');
    await expect.poll(() => existsSync(join(userData, 'startup.lock'))).toBe(false); // the first frame cleared it
  } finally {
    await app.close();
  }
});

const runPrint = (arg: string) =>
  execFileSync(electronPath as unknown as string, ['--no-sandbox', join(import.meta.dirname, '../..'), arg], {
    env: { ...process.env, ALMASOUND_USER_DATA: mkdtempSync(join(tmpdir(), 'almasound-e2e-')) },
    encoding: 'utf8',
    timeout: 60_000,
  });

test('--print-diagnostics=<file> appends the report to a file and exits', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'almasound-e2e-')), 'diagnostics.txt');
  writeFileSync(file, 'header written by diagnostics.bat\n');
  runPrint(`--print-diagnostics=${file}`);
  const text = readFileSync(file, 'utf8');
  expect(text.startsWith('header written by diagnostics.bat\nAlmaSound diagnostics')).toBe(true);
  expect(text.trimEnd().endsWith(END)).toBe(true);
  expect(text).toContain('not available (no window)');
});

// Windows GUI builds often have no stdout; the file form above is what diagnostics.bat uses there.
test('--print-diagnostics prints only the report to stdout', () => {
  test.skip(process.platform === 'win32', 'GUI-subsystem exe: stdout is not connected on Windows');
  const out = runPrint('--print-diagnostics');
  expect(out.startsWith('AlmaSound diagnostics'), out.slice(0, 300)).toBe(true);
  expect(out.trimEnd().endsWith(END)).toBe(true);
});
