import { describe, it, expect, vi } from 'vitest';
import { LanguageModel } from '../src/language-model.js';
import {
  LanguageModelPromptRole,
  LanguageModelPromptType,
} from '../src/interfaces.js';

vi.mock('node-llama-cpp', () => {
  return {
    getLlama: async () => {
      return {
        loadModel: async ({ modelPath }: { modelPath: string }) => {
          return {
            createContext: async () => {
              return {
                getSequence: () => 'dummy-sequence',
              };
            },
          };
        },
      };
    },
    LlamaChatSession: class {
      contextSequence: string;
      constructor({ contextSequence }: { contextSequence: string }) {
        this.contextSequence = contextSequence;
      }
      async prompt(input: string, options?: any): Promise<string> {
        return `Mocked response to: ${input}`;
      }
    },
  };
});

describe('LanguageModel with mocks', () => {
  const opts = {
    modelAlias: 'dummy-model',
    modelPath: 'dummy-model.gguf',
    topK: 5,
    temperature: 0.8,
    systemPrompt: 'Test system prompt',
  };

  it('should create a LanguageModel and get a response', async () => {
    const model = await LanguageModel.create(opts);
    expect(model).toBeDefined();

    const promptPayload = {
      role: LanguageModelPromptRole.USER,
      type: LanguageModelPromptType.TEXT,
      content: 'Hello, test!',
    };

    const response = await model.prompt(promptPayload);
    expect(response).toContain('Mocked response to:');
  });

  it('should stream a response via promptStreaming', async () => {
    const model = await LanguageModel.create(opts);
    expect(model).toBeDefined();

    const promptPayload = {
      role: LanguageModelPromptRole.USER,
      type: LanguageModelPromptType.TEXT,
      content: 'Tell me a test story.',
    };

    // mock streaming behaviour
    model.promptStreaming = (payload, options) => {
      return new ReadableStream({
        start(controller) {
          controller.enqueue('chunk1 ');
          controller.enqueue('chunk2 ');
          controller.close();
        },
      });
    };

    const stream = model.promptStreaming(promptPayload);
    const reader = stream.getReader();
    let output = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += value;
    }

    expect(output).toEqual('chunk1 chunk2 ');
  });

  it('should throw an error when using an unsupported prompt role', async () => {
    const model = await LanguageModel.create(opts);
    expect(model).toBeDefined();

    // TODO: SYSTEM role unsupported for now
    const promptPayload = {
      role: LanguageModelPromptRole.SYSTEM,
      type: LanguageModelPromptType.TEXT,
      content: 'This should fail.',
    };

    await expect(model.prompt(promptPayload)).rejects.toThrow(
      'NotSupportedError',
    );
  });
});
