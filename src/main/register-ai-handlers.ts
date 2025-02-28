import {
  BrowserWindow,
  dialog,
  ipcMain,
  utilityProcess,
  UtilityProcess,
} from 'electron';
import { IpcRendererMessage } from '../common/ipc-channel-names';
import { once } from 'node:events';
import path from 'node:path';

let modelPath: string | null = null;
let aiProcess: UtilityProcess | null = null;

export function registerAiHandlers() {
  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_START_PROCESS,
    async (event, options) => {
      console.log('Received start process request', options);
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_STOP_PROCESS,
    async (event) => {
      try {
        stopModel();
      } catch (error) {
        console.error('Failed to stop previous AI model process.');
        throw error;
      }

      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow) {
        throw new Error('startAiModelProcess: No focused window.');
      }

      const result = await dialog.showOpenDialog(focusedWindow, {
        properties: ['openFile'],
        filters: [{ name: 'GGUF models', extensions: ['gguf'] }],
        title: 'Select a GGUF model',
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error(
          'startAiModelProcess: error selecting path to GGUF model.',
        );
      }

      modelPath = result.filePaths[0];
      aiProcess = await startAiModel();
      if (!aiProcess) {
        throw new Error(
          'startAiModelProcess: error starting AI model process.',
        );
      }
      const messagePromise = once(aiProcess, 'message');
      aiProcess.postMessage({ type: 'loadModel', data: { modelPath } });

      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(
          () => reject(new Error('AI model process start timed out.')),
          20000,
        );
      });

      // give the AI model process 20 seconds to load the model
      const [data] = await Promise.race([messagePromise, timeoutPromise]);

      const { type, data: responseData } = data;
      if (type === 'modelLoaded') {
        return;
      } else if (type === 'error') {
        throw new Error(responseData);
      } else {
        throw new Error(`Unexpected message type: ${type}`);
      }
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_PROMPT,
    async (event, prompt) => {
      console.log('Received prompt request', prompt);
      return 'Response to prompt';
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_GET_CONVERSATION_HISTORY,
    async (event) => {
      console.log('Received get conversation history request');
      return [];
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_RESET_CONVERSATION_HISTORY,
    async (event) => {
      console.log('Received reset conversation history request');
    },
  );
}

export async function startAiModel(): Promise<UtilityProcess> {
  const utilityScriptPath = path.join(
    __dirname,
    'call-ai-model-entry-point.bundle.js',
  );

  const aiProcess = utilityProcess.fork(utilityScriptPath, [], {
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  });

  if (aiProcess.stdout) {
    aiProcess.stdout.on('data', (data) => {
      console.info(`AI model child process stdout: ${data}`);
    });
  }
  if (aiProcess.stderr) {
    aiProcess.stderr.on('data', (data) => {
      console.error(`AI model child process stderror: ${data}`);
    });
  }

  aiProcess.on('exit', () => {
    aiProcess.kill();
  });

  return aiProcess;
}

function stopModel() {
  if (aiProcess) {
    aiProcess.postMessage({ type: 'stop' });
    aiProcess.kill();
    aiProcess = null;
  }
}
