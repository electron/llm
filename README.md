# @electron/llm

[![Test](https://github.com/electron/llm/actions/workflows/test.yml/badge.svg)](https://github.com/electron/llm/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@electron/llm.svg)](https://npmjs.org/package/@electron/llm)

This module makes it easy for developers to prototype local-first applications interacting with local large language models (LLMs), especially in chat contexts.

It aims for an API surface similar to Chromium's `window.AI` API, except that you can supply any GGUF model. Under the hood, `@electron/llm` makes use of [node-llama-cpp](https://github.com/withcatai/node-llama-cpp). Our goal is to make use of native LLM capabilities in Electron _easier_ than if you consumed a Llama.cpp implementation directly - but not more feature-rich. Today, this module provides a reference implementation of `node-llama-cpp` that loads the model in a utility process and uses Chromium Mojo IPC pipes to efficiently facilitate streaming of responses between the utility process and renderers. If you're building an advanced app with LLM, you might want to use this module as a reference for your process architecture.

`@electron/llm` is an experimental package. The Electron maintainers are exploring different ways to support and enable developers interested in running language models locally - and this package is just one of the potential avenues we're exploring. It's possible that we'll go in a different direction. Before using this package in a production app, be aware that you might have to migrate to something else!

# Quick Start

## Installing the module, getting a model

First, install the module in your Electron app:

```
npm i --save @electron/llm
```

Then, you need to load a model. The AI space seems to move at the speed of light, [so pick whichever GGUF model suits your purposes best](https://huggingface.co/models?library=gguf). If you just want to work with a small chat model that works well, we recommend `Meta-Llama-3-8B-Instruct.Q4_K_M.gguf`, which you can download [here](https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/tree/main). Put this file in a path reachable by your app.

## Loading `@electron/llm`

Then, in your `main` process, load the module. Make sure to do _before_ you load any windows to make sure that the `window.electronAi` API
is available.

```ts:main.js
import { app } from "electron"
import { loadElectronLlm } from "@electron/llm"

app.on("ready", () => {
  await loadElectronLlm()
  await createBrowserWindow()
})

async function createBrowserWindow() {
  // ...
}
```

## Chatting with the model

You can now use this module in any renderer. By default, `@electron/llm` auto-injects a preload script that exposes `window.electronAi`.

```
// First, load the model
await window.electronAi.create({
  modelPath: "/full/path/to/model.gguf"
})

// Then, talk to it
const response = await window.electronAi.prompt("Hi! How are you doing today?")
```

## API

### Main Process API

#### `loadElectronLlm(options?: LoadOptions): Promise<void>`

Loads the LLM module in the main process.

- `options`: Optional configuration
  - `isAutomaticPreloadDisabled`: If true, the automatic preload script injection is disabled
  - `getModelPath`: A function that takes a model alias and returns the full path to the GGUF model file. By default, this function returns a path in the app's userData directory: `path.join(app.getPath('userData'), 'models', modelAlias)`. You can override this to customize where models are stored.

### Renderer Process API

The renderer process API is exposed via `window.electronAi` once loaded via preload and provides the following methods:

#### `create(options: LanguageModelCreateOptions): Promise<void>`

Creates and initializes a language model instance. This module will at most create one utility process with one model loaded. If you call `create` multiple times, it will return the existing instance. If you call it with new (not deep equal) options, it will stop and unload previously loaded models and load the model defined in the new options.

- `options`: Configuration for the language model
  - `modelAlias`: Name of the model you want to load. Will be passed to `getModelPath()`.
  - `systemPrompt`: Optional system prompt to initialize the model
  - `initialPrompts`: Optional array of initial prompts to provide context
  - `topK`: Optional parameter to control diversity of generated text. 10 by default.
  - `temperature`: Optional parameter to control randomness of generated text. 0.7 by default.
  - `requestUUID`: Optional UUID to cancel the model loading using 

#### `destroy(): Promise<void>`

Destroys the current language model instance and frees resources.

#### `prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>`

Sends a prompt to the model and returns the complete response as a string.

- `input`: The prompt text to send to the model
- `options`: Optional configuration for the prompt
  - `responseJSONSchema`: Optional JSON schema to format the response as structured data
  - `signal`: Optional AbortSignal to cancel the request
  - `timeout`: Optional timeout in milliseconds (defaults to 20000ms)
  - `requestUUID`: Optional UUID to cancel the model loading using 
- Returns: A promise that resolves to the model's response

#### `promptStreaming(input: string, options?: LanguageModelPromptOptions): Promise<AsyncIterableIterator<string>>`

Sends a prompt to the model and returns the response as a stream of text chunks.

- `input`: The prompt text to send to the model
- `options`: Optional configuration for the prompt
  - `responseJSONSchema`: Optional JSON schema to format the response as structured data
  - `signal`: Optional AbortSignal to cancel the request
  - `timeout`: Optional timeout in milliseconds (defaults to 20000ms)
  - `requestUUID`: Optional UUID to cancel the model loading using 
- Returns: A promise that resolves to an async iterator of response chunks

#### `abortRequest(requestUUID: string): Promise<void>`

Allows the abortion of a currently running model load or prompting request. To use this API, make sure to pass in `requestUUID` to your
requests.

# Testing

Tests are implemented using [Vitest](https://vitest.dev/). To run the tests, use the following commands:

```bash
# Run tests once
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

For more details, see [\_\_tests\_\_/README.md](\_\_tests\_\_/README.md).
