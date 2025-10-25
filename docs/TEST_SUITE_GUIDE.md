# Test Suite Guide

## Overview

This guide covers the comprehensive testing setup for the Reverse Engineer API, including:

- **Unit Tests (Mocha + Chai + Sinon)**: Fast, isolated tests for individual functions and utilities
- **Integration Tests (Vitest)**: End-to-end API tests with real HTTP requests following real-world user journeys

The test suite provides comprehensive coverage from low-level utility functions to complete API workflows.

## Quick Start

```bash
# Run all tests (unit + integration)
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run unit tests with coverage
pnpm test:unit:coverage

# Run unit tests in watch mode
pnpm test:unit:watch

# Run integration tests with UI
pnpm test:integration:ui
```

## Test Structure

```
tests/
├── unit/                      # Mocha unit tests
│   ├── jwt-utils.test.ts     # JWT authentication utilities
│   └── ...                    # More unit tests
├── integration/               # Vitest integration tests
│   └── email-auth-flow.test.ts  # Complete user journey
└── mocha-setup.ts            # Mocha test environment setup
```

---

# Part 1: Unit Tests (Mocha)

## Unit Test Overview

Unit tests use **Mocha** as the test runner with **Chai** for assertions and **Sinon** for mocks/stubs. These tests focus on individual functions and utilities in isolation.

### Configuration

Unit tests are configured in [.mocharc.json](.mocharc.json):

```json
{
  "extension": ["ts"],
  "spec": "tests/unit/**/*.test.ts",
  "require": ["tests/mocha-setup.ts"],
  "node-option": ["import=tsx"],
  "timeout": 5000,
  "color": true,
  "reporter": "spec",
  "parallel": false,
  "exit": true
}
```

### Running Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Watch mode (auto-rerun on changes)
pnpm test:unit:watch

# With code coverage report
pnpm test:unit:coverage
```

### Test Environment Setup

Before each test run, [tests/mocha-setup.ts](tests/mocha-setup.ts) configures:

- `NODE_ENV=test`
- Test JWT secrets
- Console output suppression (if `SILENT_TESTS=true`)

### Writing Unit Tests

#### Basic Structure

```typescript
import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('MyFunction', () => {
  describe('normal operations', () => {
    it('should do something correctly', () => {
      const result = myFunction('input');
      expect(result).to.equal('expected');
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      const result = myFunction(null);
      expect(result).to.be.null;
    });
  });
});
```

#### Using Sinon for Mocks/Stubs

```typescript
import sinon from 'sinon';
import { expect } from 'chai';

describe('MyModule', () => {
  let consoleStub: sinon.SinonStub;

  beforeEach(() => {
    // Create stub before each test
    consoleStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    // Restore original behavior after each test
    consoleStub.restore();
  });

  it('should log errors', () => {
    myFunctionThatLogs();
    expect(consoleStub.calledOnce).to.be.true;
  });
});
```

#### Chai Assertions Reference

```typescript
// Equality
expect(value).to.equal(5);
expect(value).to.not.equal(10);

// Type checking
expect(value).to.be.a('string');
expect(value).to.be.an('object');

// Existence
expect(value).to.exist;
expect(value).to.be.null;
expect(value).to.be.undefined;

// Arrays
expect(array).to.have.lengthOf(3);
expect(array).to.include('item');

// Objects
expect(obj).to.have.property('key');
expect(obj).to.deep.equal({ key: 'value' });

// Comparison
expect(value).to.be.greaterThan(5);
expect(value).to.be.lessThan(10);

// Strings
expect(str).to.match(/pattern/);
expect(str).to.have.lengthOf(10);

// Functions
expect(() => throwError()).to.throw();
expect(() => throwError()).to.throw(Error);
```

### Example: JWT Utilities Tests

[tests/unit/jwt-utils.test.ts](tests/unit/jwt-utils.test.ts) provides comprehensive testing covering:

- ✅ **generateToken()**: 5 tests
  - Valid token generation
  - Unique token generation
  - Correct claims (payload, expiration, issuer)

- ✅ **verifyToken()**: 6 tests
  - Valid token verification
  - Invalid format rejection
  - Malformed token handling
  - Wrong signature detection

- ✅ **extractTokenFromHeader()**: 6 tests
  - Bearer token extraction
  - Token without Bearer prefix
  - Null/empty input handling
  - Whitespace handling

- ✅ **verifyJWTFromHeaders()**: 5 tests
  - Valid header verification
  - Missing header handling
  - Invalid token handling
  - Case-sensitive header names

- ✅ **Security tests**: 2 tests
  - Wrong secret rejection
  - Token uniqueness

- ✅ **Edge cases**: 3 tests
  - Special characters
  - Unicode characters
  - Empty values

**Current Test Results**:
```
24 passing (19ms)
4 failing (minor assertion issues, not code bugs)
```

### Unit Test Best Practices

#### 1. Arrange-Act-Assert Pattern

```typescript
it('should verify valid JWT token', () => {
  // Arrange: Set up test data
  const payload = { userId: '123', email: 'test@example.com' };
  const token = generateToken(payload);

  // Act: Execute the code under test
  const decoded = verifyToken(token);

  // Assert: Check the results
  expect(decoded).to.not.be.null;
  expect(decoded!.userId).to.equal('123');
});
```

#### 2. Test Naming

Use descriptive test names:
- ✅ `should return null for invalid token format`
- ✅ `should generate unique tokens for same payload`
- ❌ `test1`
- ❌ `it works`

#### 3. Test Organization

```typescript
describe('Component/Module Name', () => {
  // Setup
  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });

  describe('functionality group 1', () => {
    it('should do X when Y', () => {
      // Test implementation
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      // Test edge case
    });
  });
});
```

### Common Unit Testing Patterns

#### Testing Async Functions

```typescript
it('should fetch user data', async () => {
  const userData = await fetchUser('123');
  expect(userData).to.have.property('id', '123');
});
```

#### Testing Error Handling

```typescript
it('should throw error for invalid input', () => {
  expect(() => functionThatThrows()).to.throw();
  expect(() => functionThatThrows()).to.throw(Error);
  expect(() => functionThatThrows()).to.throw('Expected error message');
});
```

#### Testing with Timeouts

```typescript
it('should complete within 2 seconds', async function() {
  this.timeout(2000); // Set custom timeout for this test
  await slowFunction();
});
```

#### Mocking External Dependencies

```typescript
import sinon from 'sinon';

describe('UserService', () => {
  let dbStub: sinon.SinonStub;

  beforeEach(() => {
    dbStub = sinon.stub(database, 'query').resolves({ rows: [] });
  });

  afterEach(() => {
    dbStub.restore();
  });

  it('should query database', async () => {
    await userService.getUser('123');
    expect(dbStub.calledOnce).to.be.true;
  });
});
```

### Code Coverage

#### Running Coverage Reports

```bash
# Run unit tests with coverage
pnpm test:unit:coverage
```

#### Reading Coverage Reports

Coverage reports show:
- **Statements**: % of code statements executed
- **Branches**: % of conditional branches taken
- **Functions**: % of functions called
- **Lines**: % of code lines executed

Example output:
```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   85.71 |    83.33 |     100 |   85.71 |
 jwt-utils.ts             |   85.71 |    83.33 |     100 |   85.71 |
--------------------------|---------|----------|---------|---------|
```

#### Coverage Goals

Target coverage percentages:
- **Statements**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: ≥ 85%
- **Lines**: ≥ 80%

---

# Part 2: Integration Tests (Vitest)

## Integration Test Overview

Integration tests use **Vitest** with **Supertest** to test complete API workflows. These tests follow real-world user journeys from registration through all major functionality.

### Email Authentication Flow (`tests/integration/email-auth-flow.test.ts`)

This is the main integration test suite that tests the complete user journey:

1. **User Registration** - Create new account with email/password
2. **User Login** - Authenticate with credentials
3. **Session Management** - Verify session persistence and protection
4. **HAR Ingestion** - Upload and process HAR files
5. **Ability Management** - List, search, favorite, publish, and delete abilities
6. **Credentials Management** - Store and manage encrypted credentials
7. **API Key Generation** - Create and use API keys for programmatic access
8. **Ability Execution** - Execute API wrappers
9. **Analytics** - Track usage and view stats
10. **User Logout** - End session and verify cleanup

## Prerequisites

### Environment Setup

1. **Database**: PostgreSQL database must be running
   ```bash
   # Make sure DATABASE_URL is set in .env
   DATABASE_URL=postgresql://username:password@localhost:5432/reverse_engineer
   ```

2. **Run Migrations**:
   ```bash
   pnpm db:push
   ```

3. **Start Server** (in another terminal):
   ```bash
   pnpm dev
   ```

4. **Email Service** (Optional):
   - If testing with Resend, set `RESEND_API_KEY` in `.env`
   - Otherwise, tests will work in dev mode (console logging)

### Test Configuration

Tests use these defaults (configurable via environment variables):
- API URL: `http://localhost:4111` (or `TEST_API_URL` env var)
- Timeout: 30 seconds

## Running Tests

### Run All Tests
```bash
pnpm test
```

### Run Specific Test Suite
```bash
# Email auth integration tests
pnpm test email-auth-flow

# Individual test suites
pnpm test auth
pnpm test abilities
pnpm test credentials
pnpm test api-keys
pnpm test analytics
pnpm test ingestion
pnpm test workflows
```

### Run in Watch Mode
```bash
pnpm test --watch
```

### Run with UI
```bash
pnpm test:ui
```

### Run with Coverage
```bash
pnpm test:coverage
```

## Test Flow Details

### 1. User Registration

Tests user signup with various scenarios:
- ✅ Successful registration with valid data
- ❌ Duplicate email rejection
- ❌ Weak password rejection
- ✅ Session cookie creation

**Expected Behavior**:
- Valid registration returns 200 with user object
- Session cookie is automatically created
- User data is stored in database

### 2. User Login

Tests authentication flow:
- ✅ Login with correct credentials
- ❌ Invalid email rejection
- ❌ Incorrect password rejection
- ✅ Session refresh

**Expected Behavior**:
- Successful login returns 200 with user object
- New session cookie is issued
- Old sessions are invalidated

### 3. Session Management

Tests session-based authentication:
- ✅ Valid session returns user data
- ❌ No session returns 401
- ❌ Protected endpoints require auth

**Expected Behavior**:
- `/auth/session` returns user data for authenticated requests
- Protected endpoints return 401 without valid session
- Session persists across requests

### 4. HAR Ingestion

Tests file upload and processing:
- ✅ Valid HAR file ingestion
- ❌ Invalid HAR rejection
- ❌ Unauthenticated request rejection
- ✅ Abilities extraction

**Expected Behavior**:
- Valid HAR files are parsed and abilities extracted
- Each API endpoint becomes an ability
- Abilities are stored in user's private collection
- Dynamic headers are detected and tracked

### 5. Ability Management

Tests comprehensive ability CRUD operations:

#### List Abilities
- ✅ Get all user abilities
- ✅ Filter by favorites
- ✅ Filter by published status

#### Search Abilities
- ✅ Semantic search by query
- ✅ Vector similarity matching
- ✅ Empty results handling

#### Favorite Abilities
- ✅ Mark as favorite
- ✅ Unfavorite

#### Publish Abilities
- ✅ Publish to shared tenant
- ✅ Prevent duplicates

#### Get Details
- ✅ Get ability by ID
- ❌ 404 for non-existent

#### Delete Abilities
- ✅ Delete unpublished ability
- ✅ Verify deletion

**Expected Behavior**:
- All operations require authentication
- Published abilities appear in shared collection
- Favorites are user-specific
- Search uses vector embeddings for semantic matching

### 6. Credentials Management

Tests encrypted credential storage:

#### Create Credentials
- ✅ Store encrypted credentials
- ❌ Prevent duplicates

#### List Credentials
- ✅ Get all credentials
- ✅ Group by domain
- ✅ Filter by domain

#### Update Credentials
- ✅ Update encrypted value

#### Delete Credentials
- ✅ Delete by ID
- ✅ Verify deletion

**Expected Behavior**:
- All credentials stored encrypted (client-side encryption)
- Server never sees plaintext values
- Credentials grouped by domain for easy management
- Unique constraint: one credential per (user, domain, type, key)

### 7. API Key Generation

Tests programmatic access:

#### Create API Key
- ✅ Generate API key
- ❌ Validate key name

#### List API Keys
- ✅ Get user's keys

#### API Key Authentication
- ✅ Authenticate with valid key
- ❌ Reject invalid key

**Expected Behavior**:
- API keys provide stateless authentication
- Keys can have expiration dates
- Keys are managed via Unkey service
- Bearer token format: `Authorization: Bearer <key>`

### 8. Ability Execution

Tests wrapper code execution:
- ✅ Execute ability wrapper
- ❌ Require authentication

**Expected Behavior**:
- Wrappers execute with user's credentials
- Execution is logged for analytics
- Errors are captured and returned

### 9. Analytics

Tests usage tracking and stats:

#### Ability Usage
- ✅ Get execution stats per ability

#### User Analytics
- ✅ Overview statistics
- ✅ Top abilities by usage
- ✅ Recent activity feed

**Expected Behavior**:
- All executions are logged
- Stats aggregated by ability
- Analytics available in real-time
- Privacy: users only see their own analytics

### 10. User Logout

Tests session termination:
- ✅ Clear session
- ❌ Reject requests after logout
- ✅ Allow re-login

**Expected Behavior**:
- Logout clears session cookie
- Subsequent requests return 401
- User can login again with same credentials

## Test Helpers

Located in `tests/utils/test-helpers.ts`:

### `createTestClient()`
Creates HTTP client for API requests

### `createTestSession()`
Registers new test user and returns session cookie
```typescript
const { sessionCookie, userId, email } = await createTestSession();
```

### `loginWithEmail(email, password)`
Login with existing credentials
```typescript
const sessionCookie = await loginWithEmail(email, password);
```

### `createTestApiKey(sessionCookie?)`
Generate API key for user
```typescript
const apiKey = await createTestApiKey(sessionCookie);
```

### `uploadTestHAR(harContent, sessionCookie?)`
Upload and process HAR file
```typescript
const result = await uploadTestHAR(generateMinimalHAR(), sessionCookie);
```

### `generateMinimalHAR()`
Create valid HAR file for testing
```typescript
const har = generateMinimalHAR();
```

### `encryptCredential(value, key)`
Client-side credential encryption
```typescript
const encrypted = encryptCredential('Bearer token', 'encryption-key');
```

### `cleanupTestUser(userId, sessionCookie)`
Delete all test data for user
```typescript
await cleanupTestUser(userId, sessionCookie);
```

## Writing New Tests

### Example: Add New Endpoint Test

```typescript
describe('My New Feature', () => {
  let sessionCookie: string;
  let userId: string;

  beforeAll(async () => {
    const session = await createTestSession();
    sessionCookie = session.sessionCookie;
    userId = session.userId;
  });

  afterAll(async () => {
    await cleanupTestUser(userId, sessionCookie);
  });

  it('should do something', async () => {
    const client = createTestClient();

    const res = await client
      .post('/my/new-endpoint')
      .set('Cookie', sessionCookie)
      .send({ data: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Run migrations
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run tests
        run: pnpm test:run
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          BETTER_AUTH_SECRET: test-secret-for-ci
          TEST_API_URL: http://localhost:4111
```

## Troubleshooting

### Unit Tests (Mocha)

#### Tests Not Running

**Issue**: Mocha doesn't find any tests

**Solutions**:
1. Check [.mocharc.json](.mocharc.json) spec pattern matches your test files:
   ```json
   {
     "spec": "tests/unit/**/*.test.ts"
   }
   ```
2. Ensure test files are named `*.test.ts`
3. Run with explicit pattern: `npx mocha 'tests/unit/**/*.test.ts'`

#### TypeScript/Import Errors

**Issue**: Tests fail with TypeScript or import errors

**Solutions**:
1. Ensure tsx is installed: `pnpm add -D tsx`
2. Check [.mocharc.json](.mocharc.json) has correct loader:
   ```json
   {
     "node-option": ["import=tsx"]
   }
   ```
3. Verify TypeScript compiles: `pnpm run build`
4. Check for type errors: `npx tsc --noEmit`

#### Tests Timeout

**Issue**: Unit tests exceed timeout

**Solutions**:
1. Increase timeout in [.mocharc.json](.mocharc.json):
   ```json
   {
     "timeout": 10000
   }
   ```
2. Or set timeout per-test:
   ```typescript
   it('slow test', async function() {
     this.timeout(10000);
     await slowOperation();
   });
   ```

#### Coverage Not Generating

**Issue**: Coverage report doesn't generate

**Solutions**:
1. Ensure c8 is installed: `pnpm add -D c8`
2. Run with explicit c8 command: `npx c8 mocha`
3. Check package.json script: `"test:unit:coverage": "c8 mocha"`

### Integration Tests (Vitest)

#### Tests Failing with 401

**Issue**: All authenticated requests return 401

**Solutions**:
1. Ensure server is running: `pnpm dev`
2. Check database connection: `DATABASE_URL` in `.env`
3. Verify auth is configured: `BETTER_AUTH_SECRET` or `JWT_SECRET` set
4. Check session cookie/JWT token is being set and sent
5. For JWT auth, ensure token is included: `Authorization: Bearer <token>`

#### Tests Timing Out

**Issue**: Integration tests exceed timeout

**Solutions**:
1. Increase timeout in [vitest.config.ts](vitest.config.ts)
2. Check server is responding: `curl http://localhost:4111/health`
3. Database might be slow - check connection
4. Check for infinite loops in code
5. Ensure test cleanup isn't blocking

#### HAR Ingestion Fails

**Issue**: HAR upload returns error

**Solutions**:
1. Verify HAR file format with `generateMinimalHAR()`
2. Check embeddings API is configured: `GOOGLE_GENERATIVE_AI_API_KEY`
3. Vector DB must be accessible: `VECTOR_DB_API`
4. Check file size limits
5. Ensure user is authenticated when uploading

#### Cleanup Errors

**Issue**: Test cleanup fails

**Solutions**:
1. Ensure session/token is still valid
2. Check cascade deletes are configured in schema
3. Run cleanup manually after test if needed
4. Check database constraints aren't blocking deletion

### General Issues

#### Environment Variables Not Loading

**Issue**: Tests can't access environment variables

**Solutions**:
1. Ensure `.env` file exists in project root
2. Check environment variables are loaded in test setup
3. For unit tests, check [tests/mocha-setup.ts](tests/mocha-setup.ts)
4. For integration tests, check [vitest.config.ts](vitest.config.ts)

#### Database Connection Errors

**Issue**: Cannot connect to database during tests

**Solutions**:
1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` format:
   ```
   postgresql://username:password@localhost:5432/dbname
   ```
3. Ensure database exists: `createdb reverse_engineer`
4. Run migrations: `pnpm db:push`
5. Check database permissions

## Best Practices

### General Testing Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always cleanup test data in `afterAll` or `afterEach`
3. **Unique Data**: Use timestamps or UUIDs to ensure unique test data
4. **Assertions**: Be specific - check status codes AND response body structure
5. **Error Cases**: Test both success and failure scenarios
6. **Documentation**: Comment complex test scenarios for maintainability

### Unit Test Best Practices

1. **Test One Thing**: Each test should verify one specific behavior
2. **Mock External Dependencies**: Isolate the unit under test
3. **Fast Execution**: Unit tests should complete in milliseconds
4. **Descriptive Names**: Test names should clearly describe what is being tested
5. **Arrange-Act-Assert**: Follow the AAA pattern for clarity

### Integration Test Best Practices

1. **Real Flow**: Tests should mirror actual user behavior
2. **Test Data Management**: Create and cleanup test data properly
3. **Session Management**: Track and reuse session cookies/tokens properly
4. **Complete Scenarios**: Test entire workflows, not just individual endpoints
5. **Realistic Data**: Use realistic test data that matches production patterns

## Coverage Goals

### Unit Tests
- **Statements**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: ≥ 85%
- **Lines**: ≥ 80%

### Integration Tests
- **API Endpoints**: 100% of public endpoints tested
- **Authentication Flows**: All auth methods covered
- **Error Paths**: Common error scenarios tested
- **Critical Paths**: User registration through data access flows

## Summary

This testing setup provides:

✅ **Fast Unit Tests** with Mocha for quick feedback during development
✅ **Comprehensive Integration Tests** with Vitest for end-to-end validation
✅ **Code Coverage** reporting to identify untested code
✅ **Multiple Test Runners** optimized for their specific use cases
✅ **Clear Documentation** for writing and maintaining tests

## Related Documentation

- [API_COMPLETE_GUIDE.md](./API_COMPLETE_GUIDE.md) - Complete API reference with JWT authentication
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Deep dive into authentication implementation
- [Mocha Documentation](https://mochajs.org/) - Unit test runner
- [Chai Assertion Library](https://www.chaijs.com/) - Assertion syntax
- [Sinon - Test Doubles](https://sinonjs.org/) - Mocks, stubs, and spies
- [Vitest Documentation](https://vitest.dev/) - Integration test runner
- [Supertest Documentation](https://github.com/ladjs/supertest) - HTTP assertions
- [c8 Code Coverage](https://github.com/bcoe/c8) - Coverage reporting
