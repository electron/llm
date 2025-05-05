import { contextBridge, ipcRenderer } from 'electron';

import type {
  ElectronLlmRenderer,
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
  RendererLoadFunction,
} from '../interfaces.js';

/**
 * Validates the options for creating a language model.
 *
 * @param options - The options to validate.
 * @throws {TypeError} If the options are invalid.
 */
function validateCreateOptions(options?: LanguageModelCreateOptions): void {
  if (!options) return;

  if (
    options.modelAlias === undefined ||
    typeof options.modelAlias !== 'string'
  ) {
    throw new TypeError('modelAlias is required and must be a string');
  }

  if (
    options.systemPrompt !== undefined &&
    typeof options.systemPrompt !== 'string'
  ) {
    throw new TypeError('systemPrompt must be a string');
  }

  if (
    options.initialPrompts !== undefined &&
    !Array.isArray(options.initialPrompts)
  ) {
    throw new TypeError('initialPrompts must be an array');
  }

  if (
    options.topK !== undefined &&
    (typeof options.topK !== 'number' || options.topK <= 0)
  ) {
    throw new TypeError('topK must be a positive number');
  }

  if (
    options.temperature !== undefined &&
    (typeof options.temperature !== 'number' || options.temperature < 0)
  ) {
    throw new TypeError('temperature must be a non-negative number');
  }
}

/**
 * Validates the options for prompting a language model.
 *
 * @param options - The options to validate.
 * @throws {TypeError} If the options are invalid.
 */
function validatePromptOptions(options?: LanguageModelPromptOptions): void {
  if (!options) return;

  if (
    options.responseJSONSchema !== undefined &&
    typeof options.responseJSONSchema !== 'object'
  ) {
    throw new TypeError('responseJSONSchema must be an object');
  }
}

const electronAi: ElectronLlmRenderer = {
  create: async (options?: LanguageModelCreateOptions): Promise<void> => {
    validateCreateOptions(options);

    return ipcRenderer.invoke('ELECTRON_LLM_CREATE', options);
  },
  destroy: async (): Promise<void> =>
    ipcRenderer.invoke('ELECTRON_LLM_DESTROY'),
  prompt: async (
    input: string = '',
    options?: LanguageModelPromptOptions,
  ): Promise<string> => {
    validatePromptOptions(options);
    return ipcRenderer.invoke('ELECTRON_LLM_PROMPT', input, options);
  },
  promptStreaming: async (
    input: string = '',
    options?: LanguageModelPromptOptions,
  ): Promise<AsyncIterableIterator<string>> => {
    validatePromptOptions(options);

    // Create a promise that will resolve with the port from main process
    return new Promise((resolve) => {
      ipcRenderer.once('ELECTRON_LLM_PROMPT_STREAMING_PORT', (event) => {
        // Access the port from the event's ports array
        const [port] = event.ports;

        // Start the port to receive messages
        port.start();

        const iterator: AsyncIterableIterator<string> = {
          async next(): Promise<IteratorResult<string, any>> {
            const message = await new Promise<IteratorResult<string, any>>(
              (resolve, reject) => {
                port.onmessage = (event) => {
                  if (event.data.type === 'error') {
                    reject(new Error(event.data.error));
                  } else if (event.data.type === 'done') {
                    resolve({ done: true, value: undefined });
                  } else {
                    resolve({ value: event.data.chunk, done: false });
                  }
                };
              },
            );
            return message;
          },
          async return() {
            port.close();
            return { done: true, value: undefined };
          },
          async throw(error) {
            port.close();
            throw error;
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };

        resolve(iterator);
      });

      // Request streaming from main process
      ipcRenderer.send('ELECTRON_LLM_PROMPT_STREAMING_REQUEST', input, options);
    });
  },
  abortRequest(requestUUID: string): Promise<void> {
    return ipcRenderer.invoke('ELECTRON_LLM_ABORT_REQUEST', { requestUUID });
  },
};

export const loadElectronLlm: RendererLoadFunction = async () => {
  contextBridge.exposeInMainWorld('electronAi', electronAi);
};

loadElectronLlm();
