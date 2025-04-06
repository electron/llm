import { ipcMain, utilityProcess, UtilityProcess } from 'electron';
import { once } from 'node:events';
import path from 'node:path';

import { IpcRendererMessage } from '../common/ipc-channel-names.js';
import {
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from '../language-model.js';

let aiProcess: UtilityProcess | null = null;

export function registerAiHandlers() {
  ipcMain.handle(IpcRendererMessage.ELECTRON_LLM_DESTROY, async (event) => {
    stopModel();
  });

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_CREATE,
    async (_event, options?: LanguageModelCreateOptions) => {
      try {
        stopModel();
      } catch (error) {
        throw new Error(
          `Failed to stop previous AI model process: ${(error as Error).message || 'Unknown error'}`,
        );
      }

      aiProcess = await startAiModel();
      if (!aiProcess) {
        throw new Error(
          'startAiModelProcess: error starting AI model process.',
        );
      }
      const messagePromise = once(aiProcess, 'message');
      aiProcess.postMessage({ type: 'loadModel', data: options });

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
    async (event, input: string, options: LanguageModelPromptOptions) => {
      if (!aiProcess) {
        throw new Error('AI model process not started.');
      }
      aiProcess.postMessage({
        type: 'sendPrompt',
        data: { input, stream: false, options },
      });

      const responsePromise = once(aiProcess, 'message').then(([msg]) => {
        const { type, data } = msg;
        if (type === 'done') {
          return data;
        } else if (type === 'error') {
          throw new Error(data);
        } else {
          throw new Error(`Unexpected message type: ${type}`);
        }
      });

      // Set a timeout (e.g., 20 seconds) in case the child process doesn't reply.
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Prompt response timed out.')),
          20000,
        );
      });

      return await Promise.race([responsePromise, timeoutPromise]);
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING,
    async (event, input, options) => {
      if (!aiProcess) {
        throw new Error('AI model process not started.');
      }
      aiProcess.postMessage({
        type: 'sendPrompt',
        data: { input, stream: true, options },
      });

      const streamPromise = new Promise<string[]>((resolve, reject) => {
        const chunks: string[] = [];

        const handler = ([msg]: any[]) => {
          const { type, data } = msg;
          if (type === 'stream') {
            processChunk(data);
            chunks.push(data);
          } else if (type === 'done') {
            aiProcess?.removeListener('message', handler);
            resolve(chunks);
          } else if (type === 'error') {
            aiProcess?.removeListener('message', handler);
            reject(new Error(data));
          }
        };

        aiProcess?.on('message', handler);

        // Give the AI model process 30 seconds to stream the response.
        setTimeout(() => {
          aiProcess?.removeListener('message', handler);
          reject(new Error('Prompt streaming timed out.'));
        }, 30000);
      });

      return await streamPromise;
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
    aiProcess = null;
  }
}

function processChunk(data: any) {
  console.log(`Received chunk: ${data}`);
}
