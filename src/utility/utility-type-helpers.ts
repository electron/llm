import {
  AiProcessModelCreateData,
  AiProcessSendPromptData,
} from '../interfaces';
import { UTILITY_MESSAGE_TYPES } from './messages';

export interface UnknownMessage {
  type: string;
  data: unknown;
  port?: Electron.MessagePortMain;
}

export interface LoadModelMessage extends UnknownMessage {
  type: typeof UTILITY_MESSAGE_TYPES.LOAD_MODEL;
  data: AiProcessModelCreateData;
}

export interface PromptMessage extends UnknownMessage {
  type: typeof UTILITY_MESSAGE_TYPES.SEND_PROMPT;
  data: AiProcessSendPromptData;
}

export interface AbortMessage extends UnknownMessage {
  type: typeof UTILITY_MESSAGE_TYPES.REQUEST_ABORTED;
  data: { requestUUID: string };
}

export interface StopMessage extends UnknownMessage {
  type: typeof UTILITY_MESSAGE_TYPES.STOP;
  data: undefined;
}

function isMessage(message: unknown): message is UnknownMessage {
  return typeof message === 'object' && message !== null && 'type' in message;
}

export function isLoadModelMessage(
  message: unknown,
): message is LoadModelMessage {
  return (
    isMessage(message) &&
    message.type === UTILITY_MESSAGE_TYPES.LOAD_MODEL &&
    'data' in message
  );
}

export function isPromptMessage(message: unknown): message is PromptMessage {
  return (
    isMessage(message) &&
    message.type === UTILITY_MESSAGE_TYPES.SEND_PROMPT &&
    'data' in message
  );
}

export function isAbortMessage(message: unknown): message is AbortMessage {
  return (
    isMessage(message) &&
    message.type === UTILITY_MESSAGE_TYPES.REQUEST_ABORTED &&
    'data' in message
  );
}

export function isStopMessage(message: unknown): message is StopMessage {
  return isMessage(message) && message.type === UTILITY_MESSAGE_TYPES.STOP;
}

/**
 * Parses the message event, returning properly typed messages.
 *
 * @param messageEvent The message event to parse.
 * @throws {Error} If the message data is invalid.
 * @returns
 */
export function parseMessageEvent(messageEvent: Electron.MessageEvent) {
  const data = messageEvent.data.data;
  const type = messageEvent.data.type;
  const [port] = messageEvent.ports || [];
  const message = { type, data, port };

  if (type === UTILITY_MESSAGE_TYPES.LOAD_MODEL) {
    return message as LoadModelMessage;
  }

  if (type === UTILITY_MESSAGE_TYPES.SEND_PROMPT) {
    return message as PromptMessage;
  }

  if (type === UTILITY_MESSAGE_TYPES.REQUEST_ABORTED) {
    return message as AbortMessage;
  }

  if (type === UTILITY_MESSAGE_TYPES.STOP) {
    return message as StopMessage;
  }

  throw new Error(`Unknown message type: ${type}`);
}
