import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './launch';

let app: ElectronApplication;
let page: Page;
let errors: string[];

test.beforeAll(async () => {
  ({ app, page, errors } = await launchApp());
});

test.afterAll(async () => {
  await app?.close();
});

test.afterEach(() => {
  expect(errors, 'errors in the renderer console').toEqual([]);
});

const chipNames = () => page.getByTestId('chips').locator('.chip-name').allTextContents();

test('builds a progression from an idea in a chosen key', async () => {
  await page.getByLabel('Key', { exact: true }).selectOption({ label: 'C major' });
  await expect(page.getByRole('group', { name: 'Chords in this key' }).getByRole('button')).toHaveCount(7);
  await page.getByLabel('Ideas', { exact: true }).selectOption({ label: 'Pop (I–V–vi–IV)' });
  await expect.poll(chipNames).toEqual(['C', 'G', 'Am', 'F']);
  await expect(page.getByTestId('chord-title')).toContainText('C');
});

test('adds a chord by clicking it, changes its length and removes it', async () => {
  await page.getByRole('group', { name: 'Chords in this key' }).getByRole('button', { name: /^Dm/ }).click();
  await expect.poll(chipNames).toEqual(['C', 'G', 'Am', 'F', 'Dm']);
  await page.getByRole('button', { name: '4 beats · click to change' }).first().click();
  await expect(page.getByRole('button', { name: '2 beats · click to change' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove Dm' }).click();
  await expect.poll(chipNames).toEqual(['C', 'G', 'Am', 'F']);
  // The full mode shows the same progression as text.
  await page.getByText('Full', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Progression' })).toHaveValue('C:2 G Am F');
  await page.getByText('Simple', { exact: true }).click();
  await expect(page.getByLabel('Key', { exact: true })).toHaveValue('0-major'); // the chosen key survives the switch
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/simple-mode.png' });
});

test('switches the note transition between smooth and instant', async () => {
  await page.getByTestId('stage').hover();
  await page.mouse.wheel(0, 300); // move past the first chord change
  await page.getByText('Instant', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Instant' })).toBeChecked();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/transition-instant.png' });
  await page.getByText('Smooth', { exact: true }).click();
  await page.getByTestId('play').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'test-results/transition-smooth.png' });
});
