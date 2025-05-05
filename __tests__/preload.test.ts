import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadElectronLlm } from '../src/preload/index.ts';
import { IpcRendererMessage } from '../src/common/ipc-channel-names.js';

vi.mock('electron', () => {
  return {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      send: vi.fn(),
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
    (globalThis as any).electronAi = undefined;
    vi.clearAllMocks();
    await loadElectronLlm();
    ipcRenderer = (await import('electron')).ipcRenderer;
  });

  it('should expose electronAi on globalThis', () => {
    expect((globalThis as any).electronAi).toBeDefined();
  });

  it('create should invoke with correct ipcMessage and options', async () => {
    const options = { modelAlias: 'dummy-model' };
    await (globalThis as any).electronAi.create(options);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_CREATE,
      options,
    );
  });

  it('destroy should invoke with correct ipcMessage', async () => {
    await (globalThis as any).electronAi.destroy();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_DESTROY,
    );
  });

  it('prompt should invoke with correct params', async () => {
    const input = 'Test prompt';
    const options = { responseJSONSchema: { type: 'string' } };
    await (globalThis as any).electronAi.prompt(input, options);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_PROMPT,
      input,
      options,
    );
  });

  it('promptStreaming should invoke with correct params', async () => {
    const input = 'Test prompt for streaming';

    // Mock the MessagePort for streaming responses
    const mockPort = {
      start: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };

    // Mock the event with ports array
    const mockEvent = {
      ports: [mockPort],
    };

    // Set up the once handler to be called with our mock event
    ipcRenderer.once.mockImplementation((_channel, callback) => {
      callback(mockEvent);

      expect(mockPort.onmessage).toBeDefined();

      if (mockPort.onmessage) {
        (mockPort as unknown as MessagePort).onmessage!({
          data: {
            type: 'chunk',
            chunk: 'Hello, world!',
          },
        } as MessageEvent);

        (mockPort as unknown as MessagePort).onmessage!({
          data: {
            type: 'done',
          },
        } as MessageEvent);
      }
    });

    await (globalThis as any).electronAi.promptStreaming(input);

    expect(ipcRenderer.send).toHaveBeenCalledWith(
      IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING_REQUEST,
      input,
      undefined,
    );
    expect(mockPort.start).toHaveBeenCalled();
  });
});
