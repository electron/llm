import { session, app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import { GetModelPathFunction, MainLoadFunction } from '../interfaces.js';
import { registerAiHandlers } from './register-ai-handlers.js';

export const loadElectronLlm: MainLoadFunction = async (options) => {
  if (!options?.isAutomaticPreloadDisabled) {
    // Developers might load @electron/llm in their main process after BrowserWindows have already been created.
    // This can cause issues because the preload script won't be loaded in those windows.
    // This function checks for this case and warns the developer.
    warnIfWindowsExist();

    // Register preload for default session
    registerPreload(session.defaultSession);

    // Also register preload for new sessions
    app.on('session-created', (session) => {
      registerPreload(session);
    });
  }

  const getModelPath: GetModelPathFunction =
    options?.getModelPath ||
    (async (modelAlias: string) => {
      const baseModelsPath = path.resolve(app.getPath('userData'), 'models');
      if (!fs.existsSync(baseModelsPath)) {
        return null;
      }
      const finalPath = path.resolve(baseModelsPath, modelAlias);
      if (!fs.existsSync(finalPath)) {
        // Let's not load a model that doesn't exist
        return null;
      }
      const realPath = await fs.promises.realpath(finalPath);
      const relativePath = path.relative(baseModelsPath, realPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        // Model is outside of the base models path
        return null;
      }
      return realPath;
    });

  // Register handler
  registerAiHandlers({ getModelPath });
};

/**
 * Registers the preload script for the given session.
 * This function is used to ensure that the preload script is loaded for all sessions.
 */
function registerPreload(session: Electron.Session) {
  const filePath = path.join(__dirname, '../preload/index.js');

  session.registerPreloadScript({
    filePath,
    type: 'frame',
  });
}

/**
 * Warns the developer if BrowserWindows have already been created before loading @electron/llm.
 * This can cause issues because the preload script won't be loaded in those windows.
 */
function warnIfWindowsExist() {
  if (app.isPackaged) {
    return;
  }

  if (BrowserWindow.getAllWindows().length > 0) {
    console.warn(
      "electron/llm: You're loading @electron/llm after BrowserWindows have already been created. " +
        "Those windows will not have access to the LLM APIs. To fix this, call @electron/llm's " +
        'load() function before creating any BrowserWindows.',
    );
  }
}

// Re-export any types or interfaces specific to the main process
export * from '../interfaces.js';
