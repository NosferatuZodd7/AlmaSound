/** Contract between the main process and the renderer (exposed as window.almasound). */

export type MenuAction = 'settings' | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'playPause' | 'restart';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface AppSettings {
  /** null until the user picks one: the OS language is used then. */
  language: string | null;
  theme: Theme;
}

export interface ConfirmOptions {
  message: string;
  detail: string;
  confirm: string;
  cancel: string;
}

export interface AlmaSoundApi {
  getSettings(): Promise<AppSettings & { systemLanguage: string }>;
  setLanguage(language: string): Promise<void>;
  /** Sets Electron's nativeTheme, which drives prefers-color-scheme and the native menus/dialogs. */
  setTheme(theme: Theme): Promise<void>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  onMenu(listener: (action: MenuAction) => void): () => void;
}

export const CHANNELS = {
  getSettings: 'settings:get',
  setLanguage: 'settings:set-language',
  setTheme: 'settings:set-theme',
  confirm: 'dialog:confirm',
  menu: 'menu:action',
} as const;
