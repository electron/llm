export interface ChatHistoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Shared interfaces
export interface ElectronLlmShared {}

// Renderer interfaces
export interface ElectronLlmRenderer {}

// Main interfaces
export interface ElectronLlmMain {}

export type MainLoadFunction = () => Promise<void>;
export type RendererLoadFunction = () => Promise<void>;
