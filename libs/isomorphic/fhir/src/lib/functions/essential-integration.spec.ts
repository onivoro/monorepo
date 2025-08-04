/**
 * Simple test runner for FHIR integration tests
 * This runs only the essential tests to verify the integration is working
 */

import { FhirTestConfig } from './fhir-test-config';
import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import axios from 'axios';

describe('Essential FHIR Integration Tests', () => {
  const timeout = 15000; // Shorter timeout

  beforeAll(() => {
    FhirTestConfig.initializeAxios();
  });

  it('should connect to FHIR server and process data', async () => {
    try {
      // Test basic connectivity
      const response = await axios.get(`${FhirTestConfig.FHIR_BASE_URL}/Patient?_count=1&_format=json`);
      expect(response.status).toBe(200);

      const bundle = response.data;
      expect(bundle.resourceType).toBe('Bundle');

      // Test normalization
      const normalizedData = normalizeFhirBundle(bundle);
      expect(normalizedData.bundles.length).toBe(1);

      console.log('✅ FHIR integration test passed successfully!');

    } catch (error) {
      console.error('❌ FHIR integration test failed:', error);
      throw error;
    }
  }, timeout);

  it('should handle normalization without errors', () => {
    const testBundle = {
      resourceType: 'Bundle' as const,
      type: 'searchset' as const,
      entry: []
    };

    const result = normalizeFhirBundle(testBundle);
    expect(result.bundles.length).toBe(1);
    expect(result.bundleEntries.length).toBe(0);

    console.log('✅ Bundle normalization test passed!');
  });
});
