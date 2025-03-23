import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from '../src/preload/index.ts';
import { IpcRendererMessage } from '../src/common/ipc-channel-names.js';

vi.mock('electron', () => {
  return {
    ipcRenderer: {
      invoke: vi.fn(),
    },
    contextBridge: {
      exposeInMainWorld: vi.fn((key, api) => {
        (globalThis as any)[key] = api;
      }),
    },
  };
});

describe('Preload Interface', () => {
  let ipcRenderer: any;

  beforeEach(async () => {
    (globalThis as any).electronLlm = undefined;
    vi.clearAllMocks();
    await load();
    ipcRenderer = (await import('electron')).ipcRenderer;
  });

  it('should expose electronLlm on globalThis', () => {
    expect((globalThis as any).electronLlm).toBeDefined();
  });

  it('create should invoke with correct ipcMessage and options', async () => {
    const options = { modelPath: 'dummy-model.gguf' };
    await (globalThis as any).electronLlm.create(options);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_CREATE,
      options,
    );
  });

  it('destroy should invoke with correct ipcMessage', async () => {
    await (globalThis as any).electronLlm.destroy();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_DESTROY,
    );
  });

  it('prompt should invoke with correct params', async () => {
    const input = 'Test prompt';
    const options = { responseJSONSchema: { type: 'string' } };
    await (globalThis as any).electronLlm.prompt(input, options);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_PROMPT,
      input,
      options,
    );
  });

  it('promptStreaming should invoke with correct params', async () => {
    const input = 'Test prompt for streaming';
    await (globalThis as any).electronLlm.promptStreaming(input);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING,
      input,
    );
  });
});
