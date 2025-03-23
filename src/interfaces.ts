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
  ) => Promise<string>;
}

// Main interfaces
export interface ElectronLlmMain {}

export type MainLoadFunction = () => Promise<void>;
export type RendererLoadFunction = () => Promise<void>;
