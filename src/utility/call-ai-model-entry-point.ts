import {
  LanguageModel,
  LanguageModelPromptRole,
  LanguageModelPromptType,
  LanguageModelPromptOptions,
  LanguageModelCreateOptions,
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
) {
  if (!languageModel) {
    process.parentPort?.postMessage({
      type: UTILITY_MESSAGE_TYPES.ERROR,
      data: 'Language model not loaded.',
    });
    return;
  }

  // TODO: support user and text types only for now
  const promptPayload = {
    role: LanguageModelPromptRole.USER,
    type: LanguageModelPromptType.TEXT,
    content: prompt,
  };

  try {
    if (stream) {
      // Use the streaming API and send each chunk via parentPort
      const readable = languageModel.promptStreaming(promptPayload, options);
      const reader = readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        process.parentPort?.postMessage({
          type: UTILITY_MESSAGE_TYPES.STREAM,
          data: value,
        });
      }
      process.parentPort?.postMessage({ type: UTILITY_MESSAGE_TYPES.DONE });
    } else {
      // Otherwise await the full response and post it
      const value = await languageModel.prompt(promptPayload, options);
      process.parentPort?.postMessage({
        type: UTILITY_MESSAGE_TYPES.DONE,
        data: value,
      });
    }
  } catch (error) {
    console.error(error);

    process.parentPort?.postMessage({
      type: UTILITY_MESSAGE_TYPES.ERROR,
      data: error,
    });
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

process.parentPort.on('message', async (msg) => {
  const { data } = msg;

  if (data.type === UTILITY_MESSAGE_TYPES.LOAD_MODEL) {
    await loadModel(data.data);
  } else if (data.type === UTILITY_MESSAGE_TYPES.SEND_PROMPT) {
    await generateResponse(
      data.data.input,
      data.data.stream,
      data.data.options,
    );
  } else if (data.type === UTILITY_MESSAGE_TYPES.STOP) {
    stopModel();
  }
});
