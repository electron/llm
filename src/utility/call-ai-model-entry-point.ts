import {
  LanguageModel,
  LanguageModelPromptRole,
  LanguageModelPromptType,
  LanguageModelPromptOptions,
  LanguageModelCreateOptions,
} from '../language-model.js';

let languageModel: LanguageModel;

async function loadModel(options: LanguageModelCreateOptions) {
  try {
    languageModel = await LanguageModel.create(options);
  } catch (error) {
    process.parentPort?.postMessage({
      type: 'error',
      data: error instanceof Error ? error.message : String(error),
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
      type: 'error',
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
        process.parentPort?.postMessage({ type: 'stream', data: value });
      }
      process.parentPort?.postMessage({ type: 'done' });
    } else {
      // Otherwise await the full response and post it
      const value = await languageModel.prompt(promptPayload, options);
      process.parentPort?.postMessage({ type: 'done', data: value });
    }
  } catch (error) {
    process.parentPort?.postMessage({
      type: 'error',
      data: error instanceof Error ? error.message : String(error),
    });
  }
}

function stopModel() {
  if (languageModel) {
    languageModel.destroy();
  }
  process.parentPort.postMessage({
    type: 'stopped',
    data: 'Model session reset.',
  });
  process.parentPort.emit('exit');
}

process.parentPort.on('message', async (msg) => {
  const { data } = msg;

  if (data.type === 'loadModel') {
    await loadModel(data.data);
  } else if (data.type === 'sendPrompt') {
    await generateResponse(
      data.data.input,
      data.data.stream,
      data.data.options,
    );
  } else if (data.type === 'stop') {
    stopModel();
  }
});
