/**
 * Jest setup file for FHIR integration tests
 * This file is run before each test suite to configure the testing environment
 */

import { FhirTestConfig } from './fhir-test-config';

// Global test setup
beforeAll(async () => {
  // Initialize axios defaults for all tests
  FhirTestConfig.initializeAxios();

  // Check if FHIR server is available
  console.log('Checking FHIR server availability...');
  const isAvailable = await FhirTestConfig.checkServerAvailability();

  if (!isAvailable) {
    console.warn('⚠️  FHIR server at http://hapi.fhir.org/baseR4 is not available.');
    console.warn('   Integration tests may fail or be skipped.');
    console.warn('   This could be due to network issues or server maintenance.');
  } else {
    console.log('✅ FHIR server is available.');
  }
});

// Clean up after all tests
afterAll(async () => {
  // Clean up axios instances to prevent open handles
  FhirTestConfig.cleanup();

  // Give a small delay to allow any pending requests to complete
  await new Promise(resolve => setTimeout(resolve, 200));

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Set up global error handling for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase default timeout for integration tests
jest.setTimeout(35000);

// Add custom matchers for FHIR resources
expect.extend({
  toBeValidFhirResource(received: any, expectedType?: string) {
    const pass = received &&
                 typeof received === 'object' &&
                 received.resourceType &&
                 received.id &&
                 (!expectedType || received.resourceType === expectedType);

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid FHIR resource${expectedType ? ` of type ${expectedType}` : ''}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid FHIR resource${expectedType ? ` of type ${expectedType}` : ''}`,
        pass: false,
      };
    }
  },

  toBeValidFhirBundle(received: any) {
    const pass = received &&
                 typeof received === 'object' &&
                 received.resourceType === 'Bundle' &&
                 received.type &&
                 ['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection'].includes(received.type);

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid FHIR bundle`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid FHIR bundle`,
        pass: false,
      };
    }
  },
});

// Declare the custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFhirResource(expectedType?: string): R;
      toBeValidFhirBundle(): R;
    }
  }
}
