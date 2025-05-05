import type {
  ChatHistoryItem,
  LlamaChatSession,
  LlamaModel,
} from 'node-llama-cpp' with { 'resolution-mode': 'import' };
import {
  LanguageModelPrompt,
  LanguageModelPromptType,
  LanguageModelPromptRole,
  LanguageModelPromptContent,
  InternalLanguageModelCreateOptions,
  InternalLanguageModelPromptOptions,
} from './interfaces';

interface LanguageModelParams {
  readonly defaultTopK: number;
  readonly maxTopK: number;
  readonly defaultTemperature: number;
  readonly maxTemperature: number;
}

interface AIAvailability {
  status: 'unavailable' | 'downloadable' | 'downloading' | 'available';
  reason?: string;
}

// prettier-ignore
let _llamaCpp: typeof import('node-llama-cpp', { with: { 'resolution-mode': 'import' } });
async function getLlamaCpp() {
  if (!_llamaCpp) {
    _llamaCpp = await import('node-llama-cpp');
  }

  return _llamaCpp;
}

export class LanguageModel {
  readonly topK: number;
  readonly temperature: number;
  private systemPrompt?: string;
  private initialPrompts?: LanguageModelPrompt[];
  private context?: any;
  private session?: LlamaChatSession;

  private static readonly paramsData: LanguageModelParams = {
    defaultTopK: 10,
    maxTopK: 100,
    defaultTemperature: 0.7,
    maxTemperature: 2.0,
  };

  private constructor(
    options: InternalLanguageModelCreateOptions,
    model: LlamaModel,
    context: any,
    session: LlamaChatSession,
  ) {
    this.topK = options.topK ?? 10;
    this.temperature = options.temperature ?? 0.7;
    this.systemPrompt = options.systemPrompt;
    this.initialPrompts = options.initialPrompts;
    this.context = context;
    this.session = session;
  }

  static async create(
    options: InternalLanguageModelCreateOptions,
  ): Promise<LanguageModel> {
    try {
      const llamaCpp = await getLlamaCpp();
      const llama = await llamaCpp.getLlama();
      const model = await llama.loadModel({ modelPath: options.modelPath });
      const context = await model.createContext();
      const session = new llamaCpp.LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: options.systemPrompt,
      });

      if (options.initialPrompts && options.initialPrompts.length > 0) {
        session.setChatHistory(
          options.initialPrompts.map(this.initialPromptToChatHistoryItem),
        );
      }

      process.parentPort?.postMessage({
        type: 'modelLoaded',
        data: 'Model loaded successfully.',
      });

      return new LanguageModel(options, model, context, session);
    } catch (error) {
      throw error;
    }
  }

  static async availability(): Promise<AIAvailability> {
    try {
      const llamaCpp = await getLlamaCpp();
      const llama = await llamaCpp.getLlama();

      if (!llama) {
        return {
          status: 'unavailable',
          reason: 'Llama runtime is not accessible.',
        };
      }

      return { status: 'available' };
    } catch (error) {
      return { status: 'unavailable', reason: (error as Error).message };
    }
  }

  static async params(): Promise<LanguageModelParams | null> {
    return Promise.resolve(LanguageModel.paramsData);
  }

  private parseContent(content: LanguageModelPromptContent): string {
    if (typeof content === 'string') {
      return content;
    } else if (content instanceof ArrayBuffer) {
      return Buffer.from(content).toString('utf-8');
    }
    throw new Error('Unsupported content type.');
  }

  async prompt(
    input: LanguageModelPrompt | LanguageModelPrompt[],
    options?: InternalLanguageModelPromptOptions,
  ): Promise<string> {
    if (!this.session) {
      process.parentPort?.postMessage({
        type: 'error',
        data: 'Model session is not initialized.',
      });

      throw new Error('Model session is not initialized.');
    }

    const prompts = Array.isArray(input) ? input : [input];
    prompts.forEach(this.validatePrompt);

    const processedInput = prompts
      .map((p) => this.parseContent(p.content))
      .join('\n');

    const response = await this.session.prompt(processedInput, {
      temperature: this.temperature,
      signal: options?.signal,
      stopOnAbortSignal: true,
      topK: this.topK,
    });

    return response;
  }

  promptStreaming(
    input: LanguageModelPrompt | LanguageModelPrompt[],
    options?: InternalLanguageModelPromptOptions,
  ): ReadableStream<string> {
    if (!this.session) {
      process.parentPort.postMessage({
        type: 'error',
        data: 'Model session is not initialized.',
      });
      throw new Error('Model session is not initialized.');
    }

    const prompts = Array.isArray(input) ? input : [input];
    prompts.forEach(this.validatePrompt);

    if (prompts[0].type !== LanguageModelPromptType.TEXT) {
      throw new Error(
        'NotSupportedError: Only text prompts are supported for streaming',
      );
    }
    const processedInput = prompts
      .map((p) => this.parseContent(p.content))
      .join('\n');

    return new ReadableStream({
      start: async (controller) => {
        await this.session!.prompt(processedInput, {
          temperature: this.temperature,
          signal: options?.signal,
          stopOnAbortSignal: true,
          topK: this.topK,

          onTextChunk: (chunk: string) => {
            controller.enqueue(chunk);
            process.parentPort?.postMessage({ type: 'stream', data: chunk });
          },
        });

        controller.close();
        process.parentPort?.postMessage({ type: 'done' });
      },
    });
  }

  private validatePrompt(prompt: LanguageModelPrompt) {
    if (prompt.role === LanguageModelPromptRole.SYSTEM) {
      throw new Error(
        "NotSupportedError: 'system' role is not allowed in prompt()",
      );
    }
  }

  private static initialPromptToChatHistoryItem(
    prompt: LanguageModelPrompt,
  ): ChatHistoryItem {
    if (prompt.role === LanguageModelPromptRole.SYSTEM) {
      return {
        type: 'system',
        text: prompt.content.toString(),
      };
    }

    if (prompt.role === LanguageModelPromptRole.USER) {
      return {
        type: 'user',
        text: prompt.content.toString(),
      };
    }

    if (prompt.role === LanguageModelPromptRole.ASSISTANT) {
      return {
        type: 'model',
        response: [prompt.content.toString()],
      };
    }

    throw new Error('Invalid prompt role.');
  }

  destroy(): void {
    this.session = undefined;
    this.context = undefined;

    process.parentPort.postMessage({
      type: 'stopped',
      data: 'Model session destroyed.',
    });
  }
}
