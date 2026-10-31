import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNELS, type AlmaSoundApi, type MenuAction, type UpdateStatus } from './ipc';

const api: AlmaSoundApi = {
  getSettings: () => ipcRenderer.invoke(CHANNELS.getSettings),
  setLanguage: (language) => ipcRenderer.invoke(CHANNELS.setLanguage, language),
  setTheme: (theme) => ipcRenderer.invoke(CHANNELS.setTheme, theme),
  setUpdateSettings: (patch) => ipcRenderer.invoke(CHANNELS.setUpdateSettings, patch),
  getUpdateStatus: () => ipcRenderer.invoke(CHANNELS.getUpdateStatus),
  checkForUpdates: () => ipcRenderer.invoke(CHANNELS.checkForUpdates),
  installUpdate: () => ipcRenderer.invoke(CHANNELS.installUpdate),
  openUpdatePage: () => ipcRenderer.invoke(CHANNELS.openUpdatePage),
  onUpdateStatus: (listener) => {
    const handler = (_e: IpcRendererEvent, status: UpdateStatus, notify: boolean) => listener(status, notify);
    ipcRenderer.on(CHANNELS.updateStatus, handler);
    return () => ipcRenderer.off(CHANNELS.updateStatus, handler);
  },
  confirm: (options) => ipcRenderer.invoke(CHANNELS.confirm, options),
  log: (level, message) => ipcRenderer.send(CHANNELS.log, level, message),
  getLog: () => ipcRenderer.invoke(CHANNELS.getLog),
  onLogLine: (listener) => {
    const handler = (_e: IpcRendererEvent, line: string) => listener(line);
    ipcRenderer.on(CHANNELS.logLine, handler);
    return () => ipcRenderer.off(CHANNELS.logLine, handler);
  },
  setDebugLogging: (on) => ipcRenderer.invoke(CHANNELS.setDebugLogging, on),
  saveDiagnostics: (target, audio) => ipcRenderer.invoke(CHANNELS.saveDiagnostics, target, audio),
  firstFrame: () => ipcRenderer.send(CHANNELS.firstFrame),
  onMenu: (listener) => {
    const handler = (_e: IpcRendererEvent, action: MenuAction) => listener(action);
    ipcRenderer.on(CHANNELS.menu, handler);
    return () => ipcRenderer.off(CHANNELS.menu, handler);
  },
};

contextBridge.exposeInMainWorld('almasound', api);
