import { MainLoadFunction } from '../interfaces';

export const load: MainLoadFunction = async () => {};

// Re-export any types or interfaces specific to the main process
export * from '../interfaces';
