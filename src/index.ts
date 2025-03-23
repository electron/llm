import { getProcessType } from './helpers/get-process-type.js';
import { MainLoadFunction, RendererLoadFunction } from './interfaces.js';

export * from './interfaces.js';
export * from './constants.js';

export async function load() {
  const processType = await getProcessType();
  let loadFunction: MainLoadFunction | RendererLoadFunction;

  if (processType === 'main') {
    loadFunction = (await import('./main/index.js')).load;
  } else if (processType === 'renderer') {
    loadFunction = (await import('./renderer/index.js')).load;
  } else if (processType === 'preload') {
    loadFunction = (await import('./preload/index.js')).load;
  } else {
    throw new Error(`Unsupported process type: ${processType}`);
  }

  await loadFunction();
}
