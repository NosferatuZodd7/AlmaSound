import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNELS, type AlmaSoundApi, type MenuAction } from './ipc';

const api: AlmaSoundApi = {
  getSettings: () => ipcRenderer.invoke(CHANNELS.getSettings),
  setLanguage: (language) => ipcRenderer.invoke(CHANNELS.setLanguage, language),
  confirm: (options) => ipcRenderer.invoke(CHANNELS.confirm, options),
  onMenu: (listener) => {
    const handler = (_e: IpcRendererEvent, action: MenuAction) => listener(action);
    ipcRenderer.on(CHANNELS.menu, handler);
    return () => ipcRenderer.off(CHANNELS.menu, handler);
  },
};

contextBridge.exposeInMainWorld('almasound', api);
