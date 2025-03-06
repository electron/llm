import { MainLoadFunction } from '../interfaces.js';
import { registerAiHandlers } from './register-ai-handlers.js';
import path from 'path';
import { app, BrowserWindow } from 'electron';

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // Log the path to be absolutely sure
  const indexPath = path.join(__dirname, '..', 'index.html');
  console.log('Loading index file from:', indexPath);

  win.loadFile(indexPath).catch((err) => {
    console.error('Failed to load index.html:', err);
  });

  win.webContents.openDevTools();
}

export const load: MainLoadFunction = async () => {
  registerAiHandlers();
  await app.whenReady();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-export any main process-specific types or interfaces
export * from '../interfaces.js';
