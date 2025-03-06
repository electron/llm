import { contextBridge, ipcRenderer } from 'electron';
import {
  ChatHistoryItem,
  ElectronLlmRenderer,
  RendererLoadFunction,
} from '../interfaces.js';
import { IpcRendererMessage } from '../common/ipc-channel-names.js';

const electronLlm: ElectronLlmRenderer = {
  // TODO: type options
  startAiModelProcess: async (options: any): Promise<void> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_START_PROCESS),
  stopAiModelProcess: async (): Promise<void> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_STOP_PROCESS),
  sendAiModelPrompt: async (prompt: string): Promise<string> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_PROMPT, prompt),
  getAiConversationHistory: async (): Promise<Array<ChatHistoryItem>> =>
    ipcRenderer.invoke(
      IpcRendererMessage.ELECTRON_LLM_GET_CONVERSATION_HISTORY,
    ),
  resetAiConversationHistory: async (): Promise<void> =>
    ipcRenderer.invoke(
      IpcRendererMessage.ELECTRON_LLM_RESET_CONVERSATION_HISTORY,
    ),
};

export const load: RendererLoadFunction = async () => {
  contextBridge.exposeInMainWorld('electronLlm', electronLlm);
};

// Export for programmatic usage
export * from '../interfaces.js';
