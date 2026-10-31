import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './launch';

// Demo mode loads a canned release into "available": no network, nothing published.
let app: ElectronApplication;
let page: Page;
let errors: string[];

test.beforeAll(async () => {
  ({ app, page, errors } = await launchApp({ ALMASOUND_UPDATE_DEMO: '1' }));
});

test.afterAll(async () => {
  await app?.close();
});

test.afterEach(() => {
  expect(errors, 'errors in the renderer console').toEqual([]);
});

test('pops the update dialog with the version change and notes', async () => {
  const dialog = page.getByTestId('update-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('You have 0.1.0 › v9.9.9');
  await expect(dialog).toContainText('Sampled instruments');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/update-dialog.png' });
});

test('"Later" only hides it; Settings still shows the update', async () => {
  await page.getByRole('button', { name: 'Later' }).click();
  await expect(page.getByTestId('update-dialog')).toBeHidden();
  await page.getByRole('button', { name: /Update available/ }).click();
  await expect(page.getByTestId('update-message')).toHaveText('Version v9.9.9 is available.');
  await expect(page.getByTestId('app-version')).toHaveText('Version 0.1.0');
  await page.screenshot({ path: 'test-results/settings-updates.png' });
});

test('a manual check without a repository says so', async () => {
  await page.getByRole('button', { name: 'Check now' }).click();
  await expect(page.getByTestId('update-message')).toHaveText('The update repository is not set (expected owner/name).');
});
