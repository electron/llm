export interface ChatHistoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Shared interfaces
export interface ElectronLlmShared {}

// Renderer interfaces
export interface ElectronLlmRenderer {
  /* TODO
   * type options
   * save chat history?
   * load chat history?
   * set temperature?
   * set max tokens?
   *
   */
  startAiModelProcess: (options: any) => Promise<void>;
  stopAiModelProcess: () => Promise<void>;
  sendAiModelPrompt: (prompt: string) => Promise<string>;
  getAiConversationHistory: () => Promise<Array<ChatHistoryItem>>;
  resetAiConversationHistory: () => Promise<void>;
}

// Main interfaces
export interface ElectronLlmMain {}

export type MainLoadFunction = () => Promise<void>;
export type RendererLoadFunction = () => Promise<void>;
