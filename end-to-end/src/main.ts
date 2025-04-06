import { app, BrowserWindow } from 'electron';
import { load } from '../../dist';
import path from 'path';
async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('../static/index.html');
}

async function setupLlm() {
  await load();
}

async function onReady() {
  await setupLlm();
  createWindow();
}

app.on('ready', onReady);
