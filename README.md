# @electron/llm

This module makes it easy for developers to build local-first applications interacting with local large language models (LLMs).

It is functionally very similar to Chromium's `window.AI` API, except that you can supply any GGUF model. Under the hood, `@electron/llm`
makes use of [node-llama-cpp](https://github.com/withcatai/node-llama-cpp).

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


