import { app, BrowserWindow } from 'electron';
import { loadElectronLlm } from '../../dist';

import path from 'path';
async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('../static/index.html');
}

async function setupLlm() {
  await loadElectronLlm();
}

async function onReady() {
  await setupLlm();
  createWindow();
}

app.on('ready', onReady);
