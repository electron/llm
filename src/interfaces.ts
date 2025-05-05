// Shared interfaces
export interface ElectronLlmShared {}

export type LanguageModelPromptContent = string | ArrayBuffer;

export enum LanguageModelPromptType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export enum LanguageModelPromptRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface LanguageModelPrompt {
  role: LanguageModelPromptRole;
  type: LanguageModelPromptType;
  content: LanguageModelPromptContent;
}

export interface LanguageModelCreateOptions {
  systemPrompt?: string;
  initialPrompts?: LanguageModelPrompt[];
  topK?: number;
  temperature?: number;
  requestUUID?: string;
  modelAlias: string;
}

export interface InternalLanguageModelCreateOptions
  extends LanguageModelCreateOptions {
  modelPath: string;
  signal?: AbortSignal;
}

export interface LanguageModelPromptOptions {
  responseJSONSchema?: object;
  requestUUID?: string;
  timeout?: number;
}

export interface InternalLanguageModelPromptOptions
  extends LanguageModelPromptOptions {
  signal?: AbortSignal;
}

export type AiProcessModelCreateData = InternalLanguageModelCreateOptions;

export interface AiProcessSendPromptData {
  options: LanguageModelPromptOptions;
  stream?: boolean;
  input: string;
}

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
  abortRequest: (requestUUID: string) => void;
}

// Main interfaces
export interface ElectronLlmMain {}

export type MainLoadOptions = {
  isAutomaticPreloadDisabled?: boolean;
  getModelPath?: GetModelPathFunction;
};

export type LoadOptions = MainLoadOptions;
export type ElectronAi = ElectronLlmRenderer;

export type MainLoadFunction = (options?: LoadOptions) => Promise<void>;
export type RendererLoadFunction = () => Promise<void>;

export type GetModelPathFunction = (
  modelAlias: string,
) => Promise<string | null> | string | null;
