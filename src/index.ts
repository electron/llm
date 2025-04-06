import { getProcessType } from './helpers/get-process-type.js';
import {
  MainLoadFunction,
  LoadOptions,
  RendererLoadFunction,
} from './interfaces.js';

export * from './interfaces.js';
export * from './constants.js';

export async function loadElectronLlm(options?: LoadOptions) {
  const processType = await getProcessType();
  let loadFunction: MainLoadFunction | RendererLoadFunction;

  if (processType === 'main') {
    loadFunction = (await import('./main/index.js')).loadElectronLlm;
  } else if (processType === 'renderer') {
    loadFunction = (await import('./renderer/index.js')).loadElectronLlm;
  } else if (processType === 'preload') {
    loadFunction = (await import('./preload/index.js')).loadElectronLlm;
  } else {
    throw new Error(`Unsupported process type: ${processType}`);
  }

  await loadFunction(options);
}
