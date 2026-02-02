/**
 * Jest configuration for integration tests
 *
 * Integration tests use Firebase Emulator and require node environment
 * (not jsdom like component tests)
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'integration',
  testEnvironment: 'node', // Node environment for Firestore operations
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__integration-tests__/**/*.integration.test.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
  ],
  // Integration tests may take longer
  testTimeout: 30000,
  // Run integration tests serially to avoid conflicts
  maxWorkers: 1,
};

module.exports = createJestConfig(customJestConfig);
