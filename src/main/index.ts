import { MainLoadFunction } from '../interfaces';
import { registerAiHandlers } from './register-ai-handlers';

export const load: MainLoadFunction = async () => {
  registerAiHandlers();
};

// Re-export any types or interfaces specific to the main process
export * from '../interfaces';
