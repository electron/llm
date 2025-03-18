import { contextBridge, ipcRenderer } from 'electron';
import { ElectronLlmRenderer, RendererLoadFunction } from '../interfaces.js';
import { IpcRendererMessage } from '../common/ipc-channel-names.js';
import {
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from '../language-model.js';

const electronLlm: ElectronLlmRenderer = {
  create: async (options?: LanguageModelCreateOptions): Promise<void> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_CREATE, options),
  destroy: async (): Promise<void> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_DESTROY),
  prompt: async (
    input: string,
    options?: LanguageModelPromptOptions,
  ): Promise<string> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_PROMPT, input, options),
  promptStreaming: async (
    input: string,
    options?: LanguageModelPromptOptions,
  ): Promise<string> =>
    ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING, input),
};

export const load: RendererLoadFunction = async () => {
  contextBridge.exposeInMainWorld('electronLlm', electronLlm);
};

// Export for programmatic usage
export * from '../interfaces.js';
