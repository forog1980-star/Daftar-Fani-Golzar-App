'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  platform: process.platform,
  getStorageInfo: () => ipcRenderer.invoke('desktop:get-storage-info'),
  openStorageFolder: (subfolder) => ipcRenderer.invoke('desktop:open-folder', subfolder),
  saveFile: (payload) => ipcRenderer.invoke('desktop:save-file', payload),
  relocateStorage: (payload) => ipcRenderer.invoke('desktop:relocate-storage', payload),
  relaunchApp: () => ipcRenderer.invoke('desktop:relaunch'),
  appendLog: (level, message) => ipcRenderer.invoke('desktop:log', { level, message }),
  fetchJson: (url) => ipcRenderer.invoke('desktop:fetch-json', url),
  downloadAndRunInstaller: (payload) => ipcRenderer.invoke('desktop:download-and-run-installer', payload),
  verifyDownloadUrl: (url) => ipcRenderer.invoke('desktop:verify-download-url', url),
});
