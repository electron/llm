import { RendererLoadFunction } from '../interfaces';

export const load: RendererLoadFunction = async () => {};

// Re-export any types or interfaces specific to the renderer process
export * from '../interfaces';
