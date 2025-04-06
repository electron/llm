import { ipcMain, utilityProcess, UtilityProcess } from 'electron';
import { once } from 'node:events';
import path from 'node:path';
import { deepEqual } from 'node:assert/strict';

import { IpcRendererMessage } from '../common/ipc-channel-names.js';
import {
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from '../language-model.js';
import { UTILITY_MESSAGE_TYPES } from '../utility/messages.js';

let aiProcess: UtilityProcess | null = null;
let aiProcessCreationOptions: LanguageModelCreateOptions | null = null;

export function registerAiHandlers() {
  ipcMain.handle(IpcRendererMessage.ELECTRON_LLM_DESTROY, () => stopModel());

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_CREATE,
    async (_event, options: LanguageModelCreateOptions) => {
      if (!shouldStartNewAiProcess(options)) {
        return;
      }

      if (aiProcess) {
        try {
          await stopModel();
        } catch (error) {
          throw new Error(
            `Failed to stop previous AI model process: ${(error as Error).message || 'Unknown error'}`,
          );
        }
      }

      aiProcess = await startAiModel();

      const messagePromise = once(aiProcess, 'message');
      aiProcess.postMessage({
        type: UTILITY_MESSAGE_TYPES.LOAD_MODEL,
        data: options,
      });

      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(
          () => reject(new Error('AI model process start timed out.')),
          60000,
        );
      });

      // Give the AI model process 60 seconds to load the model
      const [data] = await Promise.race([messagePromise, timeoutPromise]);
      const { type, data: responseData } = data;

      if (type === UTILITY_MESSAGE_TYPES.MODEL_LOADED) {
        return;
      } else if (type === UTILITY_MESSAGE_TYPES.ERROR) {
        throw new Error(responseData);
      } else {
        throw new Error(`Unexpected message type: ${type}`);
      }
    },
  );

  ipcMain.handle(
    IpcRendererMessage.ELECTRON_LLM_PROMPT,
    async (_event, input: string, options: LanguageModelPromptOptions) => {
      if (!aiProcess) {
        throw new Error(
          'AI model process not started. Please do so with `electronAi.create()`',
        );
      }

      aiProcess.postMessage({
        type: UTILITY_MESSAGE_TYPES.SEND_PROMPT,
        data: { input, stream: false, options },
      });

      const responsePromise = once(aiProcess, 'message').then(([msg]) => {
        const { type, data } = msg;
        if (type === UTILITY_MESSAGE_TYPES.DONE) {
          return data;
        } else if (type === UTILITY_MESSAGE_TYPES.ERROR) {
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
    async (_event, input, options) => {
      if (!aiProcess) {
        throw new Error('AI model process not started.');
      }

      aiProcess.postMessage({
        type: UTILITY_MESSAGE_TYPES.SEND_PROMPT,
        data: { input, stream: true, options },
      });

      const streamPromise = new Promise<string[]>((resolve, reject) => {
        const chunks: string[] = [];

        const handler = ([msg]: any[]) => {
          const { type, data } = msg;

          if (type === UTILITY_MESSAGE_TYPES.STREAM) {
            processChunk(data);
            chunks.push(data);
          } else if (type === UTILITY_MESSAGE_TYPES.DONE) {
            aiProcess?.removeListener('message', handler);
            resolve(chunks);
          } else if (type === UTILITY_MESSAGE_TYPES.ERROR) {
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
    '../utility/call-ai-model-entry-point.js',
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
    console.info('AI model child process exited.');
  });

  return aiProcess;
}

/**
 * Stops the AI model process. If the process doesn't exit after 3 seconds, it will be killed.
 */
async function stopModel(): Promise<void> {
  if (aiProcess) {
    const exitPromise = once(aiProcess, 'exit');
    aiProcess.postMessage({ type: UTILITY_MESSAGE_TYPES.STOP });

    // If the process doesn't exit after 3 seconds, kill it
    try {
      await Promise.race([
        exitPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Process exit timeout')), 3000),
        ),
      ]);
    } catch (error) {
      aiProcess.kill();
    }

    aiProcess = null;
  }
}

function shouldStartNewAiProcess(options: LanguageModelCreateOptions): boolean {
  if (!aiProcess || !aiProcessCreationOptions) {
    return true;
  }

  try {
    deepEqual(options, aiProcessCreationOptions);
    return false;
  } catch {
    return true;
  }
}

function processChunk(data: any) {
  console.log(`Received chunk: ${data}`);
}
