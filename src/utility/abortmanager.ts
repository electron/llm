import {
  InternalLanguageModelCreateOptions,
  InternalLanguageModelPromptOptions,
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
} from '../interfaces';

export class AbortSignalUtilityManager {
  private uuidToControllerMap = new Map<string, AbortController>();

  public getSignalForUUID(uuid: string): AbortSignal {
    if (!this.uuidToControllerMap.has(uuid)) {
      this.uuidToControllerMap.set(uuid, new AbortController());
    }

    return this.uuidToControllerMap.get(uuid)!.signal;
  }

  public abortSignalForUUID(uuid?: string): void {
    if (!uuid) {
      return;
    }

    const controller = this.uuidToControllerMap.get(uuid);

    if (controller) {
      controller.abort();
      this.uuidToControllerMap.delete(uuid);
    }
  }

  public getWithSignalFromCreateOptions(
    input: InternalLanguageModelCreateOptions,
  ): InternalLanguageModelCreateOptions {
    const { requestUUID, ...rest } = input;

    if (requestUUID) {
      return { ...rest, signal: this.getSignalForUUID(requestUUID) };
    }

    return rest as InternalLanguageModelCreateOptions;
  }

  public getWithSignalFromPromptOptions(
    input: LanguageModelPromptOptions,
  ): InternalLanguageModelPromptOptions {
    const { requestUUID, ...rest } = input;

    if (requestUUID) {
      return {
        ...rest,
        requestUUID,
        signal: this.getSignalForUUID(requestUUID),
      };
    }

    return rest as LanguageModelPromptOptions;
  }

  public removeUUID(uuid?: string): void {
    if (uuid) {
      this.uuidToControllerMap.delete(uuid);
    }
  }
}
