import {
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from './language-model.js';

// Shared interfaces
export interface ElectronLlmShared {}

// Renderer interfaces
export interface ElectronLlmRenderer {
  create: (options: LanguageModelCreateOptions) => Promise<void>;
  destroy: () => Promise<void>;
  prompt: (
    input: string,
    options?: LanguageModelPromptOptions,
  ) => Promise<string>;
  promptStreaming: (
    input: string,
    options?: LanguageModelPromptOptions,
  ) => Promise<AsyncIterableIterator<string>>;
}

// Main interfaces
export interface ElectronLlmMain {}

export type MainLoadOptions = {
  isAutomaticPreloadDisabled?: boolean;
};

export type LoadOptions = MainLoadOptions;
export type ElectronAi = ElectronLlmRenderer;

export type MainLoadFunction = (options?: LoadOptions) => Promise<void>;
export type RendererLoadFunction = () => Promise<void>;
