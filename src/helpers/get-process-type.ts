export type ProcessType =
  | 'main'
  | 'renderer'
  | 'preload'
  | 'utility'
  | 'worker'
  | 'unknown';

/**
 * Returns the current Electron process type
 *
 * @returns Promise<ProcessType>
 */
export async function getProcessType(): Promise<ProcessType> {
  // Check if we're in the main process
  if (process.type === 'browser') {
    return 'main';
  }

  // Check if we're in the renderer process
  if (process.type === 'renderer') {
    if (await isContextIsolatedPreload()) {
      return 'preload';
    }

    return 'renderer';
  }

  // Check for worker or utility processes
  if (process.type === 'worker') {
    return 'worker';
  }

  if (process.type === 'utility') {
    return 'utility';
  }

  // If none of the above
  return 'unknown';
}

/**
 * Returns true if the current process is a context isolated preload script.
 *
 * @returns boolean
 */
async function isContextIsolatedPreload() {
  try {
    const electron = await import('electron');

    return !!electron.contextBridge;
  } catch (error) {
    return false;
  }
}
