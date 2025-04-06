import { contextBridge, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getPathForFile(file: File) {
    return webUtils.getPathForFile(file);
  },
});
