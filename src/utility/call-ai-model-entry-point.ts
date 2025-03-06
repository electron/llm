import { getLlama, LlamaChatSession } from 'node-llama-cpp';

let model = null;
let context = null;
let session: LlamaChatSession | null = null;

async function loadModel(modelPath: string) {
  try {
    const llama = await getLlama();
    model = await llama.loadModel({ modelPath });
    context = await model.createContext();
    session = new LlamaChatSession({ contextSequence: context.getSequence() });

    process.parentPort.postMessage({
      type: 'modelLoaded',
      data: 'Model loaded successfully.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.parentPort.postMessage({ type: 'error', data: errorMessage });
  }
}

async function generateResponse(prompt: string) {
  if (!session) {
    process.parentPort.postMessage({
      type: 'error',
      data: 'Model not loaded.',
    });
    return;
  }
  let response = await session.prompt(prompt, {
    onTextChunk(chunk: string) {
      process.parentPort.postMessage({ type: 'stream', data: chunk });
    },
  });
  process.parentPort.postMessage({ type: 'done', data: response });
}

function getChatHistory() {
  if (session) {
    return session.getChatHistory();
  }
  return [];
}

function resetChatHistory() {
  if (session) {
    session.setChatHistory([]);
  }
}

function stopModel() {
  if (session) session.setChatHistory([]);
  process.parentPort.postMessage({
    type: 'stopped',
    data: 'Model session reset.',
  });
  process.parentPort.emit('exit');
}

process.parentPort.on('message', async (msg) => {
  const { data } = msg;

  if (data.type === 'loadModel') {
    await loadModel(data.data.modelPath);
  } else if (data.type === 'sendPrompt') {
    process.parentPort.postMessage({ type: 'promptReceived', data: data.data });
    await generateResponse(data.data);
  } else if (data.type === 'stop') {
    stopModel();
  } else if (data.type === 'getChatHistory') {
    process.parentPort.postMessage({
      type: 'chatHistory',
      data: getChatHistory(),
    });
  } else if (data.type === 'resetChatHistory') {
    resetChatHistory();
    process.parentPort.postMessage({
      type: 'chatHistoryReset',
      data: 'Chat history reset.',
    });
  }
});
