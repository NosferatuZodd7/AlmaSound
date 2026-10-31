import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { TFunction } from 'i18next';
import { CHANNELS, type MenuAction } from './ipc';

/**
 * Native menu, rebuilt whenever the language changes. Every label comes from locales/.
 * Accelerators are only displayed: the renderer handles every shortcut itself, so text fields
 * keep their own undo and Space can be typed in them.
 */
export function buildMenu(t: TFunction, win: BrowserWindow, isDev: boolean): Menu {
  const send = (action: MenuAction) => () => win.webContents.send(CHANNELS.menu, action);
  const item = (label: string, accelerator: string, action: MenuAction): MenuItemConstructorOptions => ({
    label: t(label),
    accelerator,
    registerAccelerator: false,
    click: send(action),
  });
  const template: MenuItemConstructorOptions[] = [
    {
      label: t('menu.file'),
      submenu: [
        item('menu.settings', 'CmdOrCtrl+,', 'settings'),
        { type: 'separator' },
        { label: t('menu.quit'), role: 'quit' },
      ],
    },
    {
      label: t('menu.edit'),
      submenu: [
        item('menu.undo', 'CmdOrCtrl+Z', 'undo'),
        item('menu.redo', 'CmdOrCtrl+Y', 'redo'),
        { type: 'separator' },
        { label: t('menu.cut'), role: 'cut' },
        { label: t('menu.copy'), role: 'copy' },
        { label: t('menu.paste'), role: 'paste' },
        { label: t('menu.selectAll'), role: 'selectAll' },
      ],
    },
    {
      label: t('menu.playback'),
      submenu: [
        item('menu.playPause', 'Space', 'playPause'),
        item('menu.restart', 'Home', 'restart'),
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        item('menu.zoomIn', 'CmdOrCtrl+=', 'zoomIn'),
        item('menu.zoomOut', 'CmdOrCtrl+-', 'zoomOut'),
        item('menu.zoomReset', 'CmdOrCtrl+0', 'zoomReset'),
        { type: 'separator' },
        { label: t('menu.fullscreen'), role: 'togglefullscreen' },
        ...(isDev ? [{ label: t('menu.devTools'), role: 'toggleDevTools' } as const] : []),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
