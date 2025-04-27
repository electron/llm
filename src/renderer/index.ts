import { RendererLoadFunction } from '../interfaces.js';

export const loadElectronLlm: RendererLoadFunction = async () => {
  throw new Error('Please load the module via preload');
};

// Re-export any types or interfaces specific to the renderer process
export * from '../interfaces.js';
