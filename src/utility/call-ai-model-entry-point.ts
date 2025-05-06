import { UTILITY_MESSAGE_TYPES } from './messages.js';
import {
  LanguageModelPromptRole,
  LanguageModelPromptType,
  LanguageModelPrompt,
} from '../interfaces.js';
import { LanguageModel } from '../language-model.js';
import { AbortSignalUtilityManager } from './abortmanager.js';
import {
  isAbortMessage,
  isLoadModelMessage,
  isPromptMessage,
  isStopMessage,
  LoadModelMessage,
  parseMessageEvent,
  PromptMessage,
} from './utility-type-helpers.js';

let languageModel: LanguageModel;
const abortSignalManager = new AbortSignalUtilityManager();

async function loadModel(message: LoadModelMessage) {
  try {
    const optionsWithSignal = abortSignalManager.getWithSignalFromCreateOptions(
      message.data,
    );

    languageModel = await LanguageModel.create(optionsWithSignal);
  } catch (error) {
    console.error(error);

    process.parentPort?.postMessage({
      type: UTILITY_MESSAGE_TYPES.ERROR,
      data: error,
    });
  } finally {
    abortSignalManager.removeUUID(message.data.requestUUID);
  }
}

async function generateResponse(message: PromptMessage) {
  const { port, data } = message;

  if (!languageModel) {
    if (port) {
      port.postMessage({ type: 'error', error: 'Language model not loaded.' });
    }
    return;
  }

  const options = abortSignalManager.getWithSignalFromPromptOptions(
    data.options,
  );

  try {
    // Format the prompt payload correctly for the language model
    const promptPayload: LanguageModelPrompt = {
      role: LanguageModelPromptRole.USER,
      type: LanguageModelPromptType.TEXT,
      content: data.input,
    };

    if (data.stream && message.port) {
      // Stream response through the provided port
      const readable = languageModel.promptStreaming(promptPayload, options);
      const reader = readable.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        message.port.postMessage({
          type: UTILITY_MESSAGE_TYPES.CHUNK,
          chunk: value,
        });
      }

      message.port.postMessage({ type: UTILITY_MESSAGE_TYPES.DONE });
    } else {
      // Handle non-streaming case
      process.parentPort?.postMessage({
        type: UTILITY_MESSAGE_TYPES.DONE,
        data: await languageModel.prompt(promptPayload, options),
      });
    }
  } catch (error) {
    if (message.port) {
      message.port.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      process.parentPort?.postMessage({
        type: UTILITY_MESSAGE_TYPES.ERROR,
        data: error,
      });
    }
  } finally {
    // abortSignalManager.removeUUID(options.requestUUID);
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

  process.exit(0);
}

process.parentPort.on('message', async (messageEvent) => {
  const message = parseMessageEvent(messageEvent);

  if (isLoadModelMessage(message)) {
    await loadModel(message);
  } else if (isPromptMessage(message)) {
    await generateResponse(message);
  } else if (isStopMessage(message)) {
    stopModel();
  } else if (isAbortMessage(message)) {
    abortSignalManager.abortSignalForUUID(message.data.requestUUID);
  }
});
