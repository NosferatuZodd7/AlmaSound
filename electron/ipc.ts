/** Contract between the main process and the renderer (exposed as window.almasound). */
import type { Channel, UpdateMessage } from '../src/core/updates/releases';

export type MenuAction = 'settings' | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'playPause' | 'restart' | 'checkUpdates';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface AppSettings {
  /** null until the user picks one: the OS language is used then. */
  language: string | null;
  theme: Theme;
  /** Check at startup. Off: the app never goes online for updates. */
  checkForUpdates: boolean;
  updateChannel: Channel;
  /** "owner/name" of the GitHub repository whose Releases are read. */
  updateRepository: string;
}

/** The settings the renderer may change for updates. */
export type UpdateSettings = Pick<AppSettings, 'checkForUpdates' | 'updateChannel' | 'updateRepository'>;

export type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'downloading' | 'ready';

export interface UpdateStatus {
  state: UpdateState;
  message: UpdateMessage | null;
  currentVersion: string;
  /** The release on offer (state available/downloading/ready). */
  release: { tag: string; name: string; notes: string; pageUrl: string; hasInstaller: boolean } | null;
  /** Download progress, 0..1. */
  progress: number;
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
  setUpdateSettings(settings: Partial<UpdateSettings>): Promise<void>;
  getUpdateStatus(): Promise<UpdateStatus>;
  /** Manual check: the result is always reported. */
  checkForUpdates(): Promise<void>;
  /** Downloads, verifies and starts the installer (or opens the release page without one). */
  installUpdate(): Promise<void>;
  openUpdatePage(): Promise<void>;
  /** `notify` is true when the UI should pop the update dialog. */
  onUpdateStatus(listener: (status: UpdateStatus, notify: boolean) => void): () => void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  onMenu(listener: (action: MenuAction) => void): () => void;
}

export const CHANNELS = {
  getSettings: 'settings:get',
  setLanguage: 'settings:set-language',
  setTheme: 'settings:set-theme',
  setUpdateSettings: 'settings:set-updates',
  getUpdateStatus: 'updates:get-status',
  checkForUpdates: 'updates:check',
  installUpdate: 'updates:install',
  openUpdatePage: 'updates:open-page',
  updateStatus: 'updates:status',
  confirm: 'dialog:confirm',
  menu: 'menu:action',
} as const;
