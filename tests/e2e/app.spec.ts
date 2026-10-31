import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { stageGeometry, yOfMidi } from '../../src/ui/stage/geometry';
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

test('starts in English, in the simple mode, with the stage drawn', async () => {
  await expect(page.getByRole('radio', { name: 'Simple' })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Chords in this key' })).toBeVisible();
  await expect(page.getByTestId('stage')).toBeVisible();
  await page.screenshot({ path: 'test-results/stage-en.png' });
});

test('full mode: reports unknown chords without blocking the others', async () => {
  await page.getByText('Full', { exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Progression' });
  await input.fill('C G Xq Am F');
  await input.press('Enter');
  await expect(page.locator('#progression-message')).toContainText('Not recognised: Xq');
});

test('plays and pauses with the button and the space bar', async () => {
  await page.getByTestId('stage').click({ position: { x: 5, y: 5 } }); // focus out of the text field
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Pause');
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Play');
  await expect(page.getByTestId('clock')).not.toHaveText(/^0:00\.0 /);
});

test('switches to Portuguese without restarting', async () => {
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByLabel('Language').selectOption('pt-PT');
  await expect(page.getByLabel('Idioma')).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-light.png' });
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('textbox', { name: 'Progressão' })).toBeVisible();
  await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Tocar');
  await page.screenshot({ path: 'test-results/stage-pt.png' });
});

test('drags a voice line to a new note, then undoes it', async () => {
  await page.keyboard.press('Home');
  const box = (await page.getByTestId('stage').boundingBox())!;
  const top = (await page.locator('header.topbar').boundingBox())!;
  const dock = (await page.locator('footer.dock').boundingBox())!;
  const g = stageGeometry(box.width, box.height, 1, { top: top.y + top.height, bottom: box.height - dock.y });
  const x = box.x + g.playX + 40; // inside the first chord, C
  const y = box.y + yOfMidi(g, 67); // its top voice, G4
  const undo = page.getByRole('button', { name: /Desfazer/ });
  const redo = page.getByRole('button', { name: /Refazer/ });
  await expect(redo).toBeDisabled();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 40, { steps: 5 });
  await page.mouse.up();
  await expect(undo).toBeEnabled();
  await page.screenshot({ path: 'test-results/stage-edited.png' });
  await page.getByTestId('stage').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Z');
  await expect(redo).toBeEnabled(); // Ctrl+Z went through the native menu to the song history
});

test('switches between light and dark themes', async () => {
  const isDark = () => page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  await page.getByRole('button', { name: /Definições/ }).click();
  await page.getByText('Escuro', { exact: true }).click();
  await expect.poll(isDark).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/settings-dark.png' });
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.getByTestId('stage').hover();
  await page.mouse.wheel(0, 500); // move ~3 s in, so the solid "past" lines show
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/stage-dark.png' });
  await page.getByRole('button', { name: /Definições/ }).click();
  await page.getByText('Claro', { exact: true }).click();
  await expect.poll(isDark).toBe(false);
  await page.getByLabel('Idioma').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/settings-picker.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/stage-light-scrolled.png' });
});

test('fits the minimum window size', async () => {
  await page.setViewportSize({ width: 720, height: 640 });
  await page.getByText('Simples', { exact: true }).click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('play')).toBeInViewport();
  await expect(page.getByRole('button', { name: /Definições/ })).toBeInViewport();
  await page.screenshot({ path: 'test-results/stage-narrow.png' });
  await page.setViewportSize({ width: 1280, height: 760 });
});
