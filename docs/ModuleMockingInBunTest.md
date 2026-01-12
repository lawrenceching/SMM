# Module mocking in bun:test

Bun didn't implement isolated test yet, the `mock.module` method takes effect globally and will impact test cases across all test files.

To resolve that, any test case that needs to mock a module must restore the module manually in an `afterAll` or `afterEach` hook.

## Critical Requirements

### 1. Use Static Imports (Not Dynamic Imports)

**✅ CORRECT:**
```typescript
import * as userServiceModule from './UserService'
const realUserService = { ...userServiceModule }
```

**❌ WRONG:**
```typescript
const realUserService = await import('./UserService')
```

**Why?** Static imports (`import * as`) are evaluated at module load time, **before** any mocks are set up. This ensures you capture references to the **real** functions. Dynamic imports (`await import()`) happen at runtime and may return mocked versions if the module was already mocked.

### 2. Spread the Module Object

**✅ CORRECT:**
```typescript
const realUserService = { ...userServiceModule }
// When restoring:
mock.module('./UserService', () => ({ ...realUserService }))
```

**❌ WRONG:**
```typescript
const realUserService = userServiceModule
// When restoring:
mock.module('./UserService', () => realUserService)
```

**Why?** Spreading creates a new object with references to the real functions. This ensures Bun's module system uses the actual function references when restoring, not cached mock references.

### 3. Restore in `afterAll` or `afterEach`

- Use `afterAll` when mocks are set up in `beforeAll` (shared across all tests in a file)
- Use `afterEach` when mocks are set up per test

## Key Steps

1. **Import the real module using static import** - `import * as moduleName from './module'`
2. **Create a spread object** - `const realModule = { ...moduleName }`
3. **Mock the module** - `mock.module('./module', () => ({ ...mockImplementation }))`
4. **Restore the module** - `mock.module('./module', () => ({ ...realModule }))`



## Example 1: Using `afterEach` (Per-Test Mocks)

```typescript
import { describe, it, expect, mock, afterEach } from 'bun:test';

// ✅ Use static import to capture real functions BEFORE any mocks
import * as userServiceModule from './UserService'

// ✅ Create spread object with real function references
const realUserService = {
    ...userServiceModule
}

describe('HealthService', () => {
    afterEach(() => {
        // ✅ Restore using spread object
        mock.module('./UserService', () => ({...realUserService}))
    });

    it('returns health status with active user count', async () => {
        const mockListUsers = mock(() => Promise.resolve(['alice', 'bob', 'charlie']));

        mock.module('./UserService', () => ({
            listUsers: mockListUsers
        }));

        const { health } = await import('./HealthService');
        const result = await health();

        expect(result.activeUsers).toBe(3);
        expect(mockListUsers).toHaveBeenCalled();
    });
});
```

## Example 2: Using `beforeAll` and `afterAll` (Shared Mocks)

When you need to mock multiple modules and share them across all tests in a file:

```typescript
import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';

// ✅ Import real modules using static imports
import * as configModule from '@/utils/config';
import * as mediaMetadataModule from '@/utils/mediaMetadata';
import * as userServiceModule from './UserService';

// ✅ Create spread objects with real function references
const realConfigModule = { ...configModule };
const realMediaMetadataModule = { ...mediaMetadataModule };
const realUserService = { ...userServiceModule };

describe('MyService tests', () => {
    beforeAll(() => {
        // Set up all mocks before importing the module under test
        mock.module('@/utils/config', () => ({
            getUserConfig: async () => ({ /* mock implementation */ }),
        }));

        mock.module('@/utils/mediaMetadata', () => ({
            findMediaMetadata: async () => ({ /* mock implementation */ }),
        }));

        mock.module('./UserService', () => ({
            listUsers: mock(() => Promise.resolve([])),
        }));

        // Import the module under test AFTER mocks are set up
        const module = await import('./MyService');
        // Use module...
    });

    afterAll(() => {
        // ✅ Restore all function mocks
        mock.restore();
        
        // ✅ Restore all modules using spread objects
        mock.module('@/utils/config', () => ({ ...realConfigModule }));
        mock.module('@/utils/mediaMetadata', () => ({ ...realMediaMetadataModule }));
        mock.module('./UserService', () => ({ ...realUserService }));
    });

    // Your tests here...
});
```


```typescript
// UserService.ts
export async function listUsers(): Promise<string[]> {
    return [
        'alice',
        'bob'
    ]
}
```

## Common Pitfalls

### ❌ Pitfall 1: Using Dynamic Imports

```typescript
// ❌ WRONG - Dynamic import may return mocked version
const realUserService = await import('./UserService');

// ✅ CORRECT - Static import captures real functions
import * as userServiceModule from './UserService';
const realUserService = { ...userServiceModule };
```

### ❌ Pitfall 2: Not Spreading When Restoring

```typescript
// ❌ WRONG - May not properly restore
mock.module('./UserService', () => realUserService);

// ✅ CORRECT - Spread ensures real function references
mock.module('./UserService', () => ({ ...realUserService }));
```

### ❌ Pitfall 3: Forgetting to Restore

If you don't restore mocks, they will leak into other test files and cause failures:

```typescript
// ❌ WRONG - No restoration
describe('MyService', () => {
    beforeAll(() => {
        mock.module('./UserService', () => ({ /* mock */ }));
    });
    // Missing afterAll!
});

// ✅ CORRECT - Always restore
describe('MyService', () => {
    beforeAll(() => {
        mock.module('./UserService', () => ({ /* mock */ }));
    });
    
    afterAll(() => {
        mock.module('./UserService', () => ({ ...realUserService }));
    });
});
```

## Why This Matters

Bun runs all tests in a **single process**. When you mock a module:

1. The mock is stored in Bun's module cache
2. All subsequent imports of that module (even in other test files) will get the mocked version
3. `mock.restore()` only restores function mocks, **not** module mocks created with `mock.module()`
4. You must explicitly restore module mocks using `mock.module()` with the real implementation

### The Module Cache Problem

Bun's module cache persists across test files. If you don't properly restore mocks:

- **Test File A** mocks `@/utils/myModule` → Module cache stores the mock
- **Test File B** imports `@/utils/myModule` → Gets the **mocked version** from cache
- **Test File B** fails because it expects the real implementation

This is why static imports and spreading are critical - they ensure you capture the real function references **before** the module cache is polluted with mocks.

## Best Practices

1. **Always use static imports** (`import * as`) to capture real modules
2. **Always spread modules** when creating restoration objects
3. **Always restore in `afterAll` or `afterEach`** to prevent leaks
4. **Restore all mocked modules** - don't forget any
5. **Use `beforeAll`/`afterAll`** when mocks are shared across tests
6. **Use `beforeEach`/`afterEach`** when mocks need to be reset per test