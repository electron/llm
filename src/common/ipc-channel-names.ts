export const IpcRendererMessage = {
  ELECTRON_LLM_ABORT_REQUEST: 'ELECTRON_LLM_ABORT_REQUEST',
  ELECTRON_LLM_CREATE: 'ELECTRON_LLM_CREATE',
  ELECTRON_LLM_DESTROY: 'ELECTRON_LLM_DESTROY',
  ELECTRON_LLM_PROMPT: 'ELECTRON_LLM_PROMPT',
  ELECTRON_LLM_PROMPT_STREAMING: 'ELECTRON_LLM_PROMPT_STREAMING',
  ELECTRON_LLM_PROMPT_STREAMING_REQUEST:
    'ELECTRON_LLM_PROMPT_STREAMING_REQUEST',
} as const;
