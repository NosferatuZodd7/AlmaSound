/** Contract between the main process and the renderer (exposed as window.almasound). */

export type MenuAction = 'settings' | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'playPause' | 'restart';

export interface AppSettings {
  /** null until the user picks one: the OS language is used then. */
  language: string | null;
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
  confirm(options: ConfirmOptions): Promise<boolean>;
  onMenu(listener: (action: MenuAction) => void): () => void;
}

export const CHANNELS = {
  getSettings: 'settings:get',
  setLanguage: 'settings:set-language',
  confirm: 'dialog:confirm',
  menu: 'menu:action',
} as const;
