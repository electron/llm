import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProcessType } from '../../src/helpers/get-process-type';

// Mock the electron module
vi.mock('electron', () => {
  return {
    contextBridge: undefined,
  };
});

describe('getProcessType', () => {
  const originalProcessType = process.type;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore process.type after each test
    Object.defineProperty(process, 'type', {
      value: originalProcessType,
      configurable: true,
    });
  });

  it('should return "main" when process.type is "browser"', async () => {
    Object.defineProperty(process, 'type', {
      value: 'browser',
      configurable: true,
    });

    const result = await getProcessType();
    expect(result).toBe('main');
  });

  it('should return "worker" when process.type is "worker"', async () => {
    Object.defineProperty(process, 'type', {
      value: 'worker',
      configurable: true,
    });

    const result = await getProcessType();
    expect(result).toBe('worker');
  });

  it('should return "utility" when process.type is "utility"', async () => {
    Object.defineProperty(process, 'type', {
      value: 'utility',
      configurable: true,
    });

    const result = await getProcessType();
    expect(result).toBe('utility');
  });

  it('should return "unknown" for any other process.type', async () => {
    Object.defineProperty(process, 'type', {
      value: 'something-else',
      configurable: true,
    });

    const result = await getProcessType();
    expect(result).toBe('unknown');
  });
});
