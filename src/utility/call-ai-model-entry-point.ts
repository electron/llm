import { MessagePortMain } from 'electron';
import {
  LanguageModel,
  LanguageModelPromptRole,
  LanguageModelPromptType,
  LanguageModelPromptOptions,
  LanguageModelCreateOptions,
  LanguageModelPrompt,
} from '../language-model.js';
import { UTILITY_MESSAGE_TYPES } from './messages.js';

let languageModel: LanguageModel;

async function loadModel(options: LanguageModelCreateOptions) {
  try {
    languageModel = await LanguageModel.create(options);
  } catch (error) {
    console.error(error);

    process.parentPort?.postMessage({
      type: UTILITY_MESSAGE_TYPES.ERROR,
      data: error,
    });
  }
}

async function generateResponse(
  prompt: string,
  stream: boolean,
  options?: LanguageModelPromptOptions,
  port?: MessagePortMain,
) {
  if (!languageModel) {
    if (port) {
      port.postMessage({ type: 'error', error: 'Language model not loaded.' });
    }
    return;
  }

  // TODO: support user and text types only for now
  const promptPayload = {
    role: LanguageModelPromptRole.USER,
    type: LanguageModelPromptType.TEXT,
    content: prompt,
  };

  try {
    if (stream && port) {
      const readable = languageModel.promptStreaming(promptPayload, options);
      const reader = readable.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        port.postMessage({ type: 'chunk', chunk: value });
      }

      port.postMessage({ type: 'done' });
      port.close();
    } else {
      // Otherwise await the full response and post it
      const value = await languageModel.prompt(promptPayload, options);
      process.parentPort?.postMessage({
        type: UTILITY_MESSAGE_TYPES.DONE,
        data: value,
      });
    }
  } catch (error) {
    if (port) {
      port.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      port.close();
    }
  }
}

function stopModel() {
  if (languageModel) {
    languageModel.destroy();
  }

  process.parentPort.postMessage({
    type: UTILITY_MESSAGE_TYPES.STOPPED,
    data: 'Model session reset.',
  });

  process.parentPort.emit('exit');
}

process.parentPort.on('message', async ({ data, ports }) => {
  const [port] = ports || [];

  if (data.type === UTILITY_MESSAGE_TYPES.LOAD_MODEL) {
    await loadModel(data.data);
  } else if (data.type === UTILITY_MESSAGE_TYPES.SEND_PROMPT) {
    try {
      // Format the prompt payload correctly for the language model
      const promptPayload: LanguageModelPrompt = {
        role: LanguageModelPromptRole.USER,
        type: LanguageModelPromptType.TEXT,
        content: data.data.input,
      };

      if (data.data.stream && port) {
        // Stream response through the provided port
        const readable = languageModel.promptStreaming(
          promptPayload,
          data.data.options,
        );
        const reader = readable.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          port.postMessage({ type: 'chunk', chunk: value });
        }

        port.postMessage({ type: 'done' });
      } else {
        // Handle non-streaming case
        await generateResponse(
          data.data.input,
          data.data.stream,
          data.data.options,
          port,
        );
      }
    } catch (error) {
      if (port) {
        port.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        process.parentPort?.postMessage({
          type: UTILITY_MESSAGE_TYPES.ERROR,
          data: error,
        });
      }
    }
  } else if (data.type === UTILITY_MESSAGE_TYPES.STOP) {
    stopModel();
  }
});
