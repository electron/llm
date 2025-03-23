import { RendererLoadFunction } from '../interfaces.js';

export const load: RendererLoadFunction = async () => {};

// Re-export any types or interfaces specific to the renderer process
export * from '../interfaces.js';
