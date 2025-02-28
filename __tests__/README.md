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

## Test Structure

Each test file corresponds to a module. For example:

- `get-process-type.test.ts` tests the functionality in `get-process-type.ts`

## Adding New Tests

When adding new tests:

1. Create a new test file with the `.test.ts` extension in the __tests__ directory
2. Import the necessary testing utilities from Vitest
3. Import the functions to test from the parent directory
4. Write your tests using the `describe`, `it`, and `expect` functions

## Mocking

For functions that rely on external dependencies or environment variables, use Vitest's mocking capabilities.

Example:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock a module
vi.mock('module-name', () => {
  return {
    functionName: vi.fn()
  };
});
```
