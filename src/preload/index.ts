import { contextBridge, ipcRenderer } from 'electron';

import type {
  ElectronLlmRenderer,
  RendererLoadFunction,
} from '../interfaces.js';
import type {
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from '../language-model.js';

const validateCreateOptions = (options?: LanguageModelCreateOptions): void => {
  if (!options) return;

  if (
    options.modelPath === undefined ||
    typeof options.modelPath !== 'string'
  ) {
    throw new TypeError('modelPath is required and must be a string');
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

  if (
    options.signal !== undefined &&
    !(options.signal instanceof AbortSignal)
  ) {
    throw new TypeError('signal must be an AbortSignal');
  }
};

const validatePromptOptions = (options?: LanguageModelPromptOptions): void => {
  if (!options) return;

  if (
    options.responseJSONSchema !== undefined &&
    typeof options.responseJSONSchema !== 'object'
  ) {
    throw new TypeError('responseJSONSchema must be an object');
  }

  if (
    options.signal !== undefined &&
    !(options.signal instanceof AbortSignal)
  ) {
    throw new TypeError('signal must be an AbortSignal');
  }
};

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
  ): Promise<string> => {
    validatePromptOptions(options);
    return ipcRenderer.invoke('ELECTRON_LLM_PROMPT_STREAMING', input, options);
  },
};

let loaded = false;

export const loadElectronLlm: RendererLoadFunction = async () => {
  if (loaded) {
    return;
  }

  contextBridge.exposeInMainWorld('electronAi', electronAi);
  loaded = true;
};

loadElectronLlm();
