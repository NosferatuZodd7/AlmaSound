import type { AlmaSoundApi } from '../electron/ipc';

declare global {
  interface Window {
    /** Set by the Electron preload; undefined in a plain browser. */
    almasound?: AlmaSoundApi;
  }
}
