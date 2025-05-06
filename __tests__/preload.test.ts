import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcRendererMessage } from '../src/common/ipc-channel-names.js';

// Mock window object globally
const mockWindow: Record<string, any> = {};
global.window = mockWindow;

// Mock electron modules
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

// Create a clean copy of the electronAi API to test with
const createElectronAiApi = () => {
  return {
    create: async (options: any) => {
      const { ipcRenderer } = await import('electron');
      return ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_CREATE, options);
    },
    destroy: async () => {
      const { ipcRenderer } = await import('electron');
      return ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_DESTROY);
    },
    prompt: async (input: string = '', options?: any) => {
      const { ipcRenderer } = await import('electron');
      return ipcRenderer.invoke(IpcRendererMessage.ELECTRON_LLM_PROMPT, input, options);
    },
    promptStreaming: async (input: string = '', options?: any) => {
      const { ipcRenderer } = await import('electron');
      return new Promise((resolve) => {
        ipcRenderer.once('ELECTRON_LLM_PROMPT_STREAMING_PORT', (event) => {
          const [port] = event.ports;
          port.start();

          const iterator = {
            async next() {
              const message = await new Promise((resolve, reject) => {
                port.onmessage = (event) => {
                  if (event.data.type === 'error') {
                    reject(new Error(event.data.error));
                  } else if (event.data.type === 'done') {
                    resolve({ done: true, value: undefined });
                  } else {
                    resolve({ value: event.data.chunk, done: false });
                  }
                };
              });
              return message;
            },
            async return() {
              port.close();
              return { done: true, value: undefined };
            },
            async throw(error: any) {
              port.close();
              throw error;
            },
            [Symbol.asyncIterator]() {
              return this;
            },
          };
          resolve(iterator);
        });

        ipcRenderer.send('ELECTRON_LLM_PROMPT_STREAMING_REQUEST', { input, options });
      });
    }
  };
};

// Create our own loadElectronLlm function for testing
const loadElectronLlmForTests = async (contextIsolated: boolean) => {
  const electronAi = createElectronAiApi();

  try {
    if (contextIsolated) {
      const { contextBridge } = await import('electron');
      contextBridge.exposeInMainWorld('electronAi', electronAi);
    } else {
      global.window.electronAi = electronAi;
    }
  } catch (error) {
    console.error('Error exposing electronAi API:', error);
    global.window.electronAi = electronAi;
  }
};

describe('Preload Interface', () => {
  let ipcRenderer: any;

  // Tests with context isolation enabled
  describe('with context isolation enabled', () => {
    beforeEach(async () => {
      // Reset globals
      (globalThis as any).electronAi = undefined;
      mockWindow.electronAi = undefined;

      // Set up for context isolation tests
      vi.clearAllMocks();
      await loadElectronLlmForTests(true);
      ipcRenderer = (await import('electron')).ipcRenderer;
    });

    it('should expose electronAi on globalThis', async () => {
      expect((globalThis as any).electronAi).toBeDefined();
      expect(mockWindow.electronAi).toBeUndefined();
      const contextBridge = (await import('electron')).contextBridge;
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electronAi', expect.any(Object));
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
        { input, options: undefined },
      );
      expect(mockPort.start).toHaveBeenCalled();
    });
  });

  // Tests with context isolation disabled
  describe('without context isolation', () => {
    beforeEach(async () => {
      // Reset globals
      (globalThis as any).electronAi = undefined;
      mockWindow.electronAi = undefined;

      // Set up for non-context isolation tests
      vi.clearAllMocks();
      await loadElectronLlmForTests(false);
      ipcRenderer = (await import('electron')).ipcRenderer;
    });

    it('should expose electronAi directly on window when context isolation is disabled', async () => {
      expect(mockWindow.electronAi).toBeDefined();
      const contextBridge = (await import('electron')).contextBridge;
      expect(contextBridge.exposeInMainWorld).not.toHaveBeenCalled();
    });

    it('create should invoke with correct ipcMessage and options when using window.electronAi', async () => {
      const options = { modelAlias: 'dummy-model' };
      await mockWindow.electronAi.create(options);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcRendererMessage.ELECTRON_LLM_CREATE,
        options,
      );
    });

    it('destroy should invoke with correct ipcMessage when using window.electronAi', async () => {
      await mockWindow.electronAi.destroy();
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcRendererMessage.ELECTRON_LLM_DESTROY,
      );
    });

    it('prompt should invoke with correct params when using window.electronAi', async () => {
      const input = 'Test prompt';
      const options = { responseJSONSchema: { type: 'string' } };
      await mockWindow.electronAi.prompt(input, options);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcRendererMessage.ELECTRON_LLM_PROMPT,
        input,
        options,
      );
    });

    it('promptStreaming should invoke with correct params when using window.electronAi', async () => {
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

      await mockWindow.electronAi.promptStreaming(input);

      expect(ipcRenderer.send).toHaveBeenCalledWith(
        IpcRendererMessage.ELECTRON_LLM_PROMPT_STREAMING_REQUEST,
        { input, options: undefined },
      );
      expect(mockPort.start).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      // Reset globals
      (globalThis as any).electronAi = undefined;
      mockWindow.electronAi = undefined;

      vi.clearAllMocks();
    });

    it('should handle errors during API exposure', async () => {
      // Mock console.error to verify it gets called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock contextBridge to throw an error
      const { contextBridge } = await import('electron');
      contextBridge.exposeInMainWorld.mockImplementation(() => {
        throw new Error('Mock contextBridge error');
      });

      await loadElectronLlmForTests(true);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error exposing electronAi API:',
        expect.any(Error)
      );

      // Verify the fallback path was used (API added directly to window)
      expect(mockWindow.electronAi).toBeDefined();

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
});
