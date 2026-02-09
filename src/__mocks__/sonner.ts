/**
 * Mock for sonner toast library
 * Used in Jest tests to prevent import errors
 */

export const toast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  loading: jest.fn(),
  message: jest.fn(),
  promise: jest.fn(),
  dismiss: jest.fn(),
  custom: jest.fn(),
};

export const Toaster = () => null;
