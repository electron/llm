import { contextBridge, ipcRenderer } from 'electron';
import { ElectronLlmRenderer, RendererLoadFunction } from '../interfaces';

const electronLlm: ElectronLlmRenderer = {};

export const load: RendererLoadFunction = async () => {
  contextBridge.exposeInMainWorld('electronLlm', electronLlm);
};

// Export for programmatic usage
export * from '../interfaces';
