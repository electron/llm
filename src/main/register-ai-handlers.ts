import {
  ipcMain,
  utilityProcess,
  UtilityProcess,
  MessageChannelMain,
} from 'electron';
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

      aiProcessCreationOptions = options;

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

      // Set a timeout in case the child process doesn't reply.
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Prompt response timed out.')),
          options.timeout || 20000,
        );
      });

      return await Promise.race([responsePromise, timeoutPromise]);
    },
  );

  ipcMain.on(
    IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING,
    (_event, { input, options }, rendererPort) => {
      if (!aiProcess) {
        rendererPort.postMessage({
          type: 'error',
          error: 'AI model process not started.',
        });
        return;
      }

      const { port1: mainPort, port2: utilityPort } = new MessageChannelMain();

      mainPort.on('message', (messageEvent) => {
        rendererPort.postMessage(messageEvent.data);
      });

      aiProcess.postMessage(
        {
          type: UTILITY_MESSAGE_TYPES.SEND_PROMPT,
          data: { input, stream: true, options },
        },
        [utilityPort],
      );
    },
  );

  ipcMain.on(
    'ELECTRON_LLM_PROMPT_STREAMING_REQUEST',
    (event, { input, options }) => {
      if (!aiProcess) {
        event.sender.send(
          'ELECTRON_LLM_PROMPT_STREAMING_ERROR',
          'AI model process not started.',
        );
        return;
      }

      // Create two message channels
      const { port1: rendererPort1, port2: rendererPort2 } =
        new MessageChannelMain();
      const { port1: utilityPort1, port2: utilityPort2 } =
        new MessageChannelMain();

      // Connect the two ports directly
      rendererPort1.on('message', (event) => {
        utilityPort1.postMessage(event.data);
      });

      utilityPort1.on('message', (event) => {
        rendererPort1.postMessage(event.data);
      });

      // Start both ports
      rendererPort1.start();
      utilityPort1.start();

      // Send one port to the renderer
      event.sender.postMessage('ELECTRON_LLM_PROMPT_STREAMING_PORT', null, [
        rendererPort2,
      ]);

      // Send the other port to the utility process
      aiProcess.postMessage(
        {
          type: UTILITY_MESSAGE_TYPES.SEND_PROMPT,
          data: { input, stream: true, options },
        },
        [utilityPort2],
      );
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
