import { FhirTestConfig, FhirTestPerformance } from './fhir-test-config';
import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import { IFhirBundle } from '../interfaces/fhir-resources.interface';

describe('FHIR Server Capabilities Integration Tests', () => {
  const timeout = FhirTestConfig.TEST_TIMEOUT;

  beforeAll(async () => {
    FhirTestConfig.initializeAxios();

    // Check if server is available before running tests
    const isAvailable = await FhirTestConfig.checkServerAvailability();
    if (!isAvailable) {
      console.warn('FHIR server is not available. Some tests may fail.');
    }
  });

  afterAll(() => {
    FhirTestPerformance.logStatistics();
    FhirTestPerformance.reset();
  });

  describe('Server Capability Tests', () => {
    it('should retrieve and validate server capability statement', async () => {
      const endMeasurement = FhirTestPerformance.startMeasurement('capability-statement');

      try {
        const capabilities = await FhirTestConfig.getServerCapabilities();

        expect(capabilities.resourceType).toBe('CapabilityStatement');
        expect(capabilities.status).toBeDefined();
        expect(capabilities.fhirVersion).toBeDefined();
        expect(capabilities.rest).toBeDefined();
        expect(Array.isArray(capabilities.rest)).toBe(true);

        // Validate that the server supports the resources we need
        const serverResources = capabilities.rest[0]?.resource || [];
        const resourceTypes = serverResources.map((r: any) => r.type);

        expect(resourceTypes).toContain('Patient');
        expect(resourceTypes).toContain('Observation');

      } finally {
        endMeasurement();
      }
    }, timeout);

    it('should handle different response formats', async () => {
      const formats = ['json', 'xml'];
      const axios = FhirTestConfig.getAxiosInstance();

      for (const format of formats) {
        const url = FhirTestConfig.buildSearchUrl('Patient', {
          [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1,
          [FhirTestConfig.SEARCH_PARAMS.FORMAT]: format
        });

        const response = await axios.get(url);
        expect(response.status).toBe(200);

        if (format === 'json') {
          expect(response.data.resourceType).toBe('Bundle');
        } else if (format === 'xml') {
          expect(typeof response.data).toBe('string');
          expect(response.data).toContain('<Bundle');
        }
      }
    }, timeout);
  });

  describe('Resource Discovery Tests', () => {
    it('should discover available resources and their search parameters', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const capabilities = await FhirTestConfig.getServerCapabilities();
      const serverResources = capabilities.rest[0]?.resource || [];

      // Test a sample of available resources
      const resourcesToTest = serverResources
        .filter((r: any) => ['Patient', 'Observation', 'Practitioner'].includes(r.type))
        .slice(0, 3);

      for (const resourceDef of resourcesToTest) {
        const resourceType = resourceDef.type;
        const url = FhirTestConfig.buildSearchUrl(resourceType, {
          [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1
        });

        const response = await axios.get(url);
        expect(response.status).toBe(200);

        const bundle: IFhirBundle = response.data;
        FhirTestConfig.validateFhirBundle(bundle);

        // Test normalization with discovered resources
        if (bundle.entry && bundle.entry.length > 0) {
          const normalizedData = normalizeFhirBundle(bundle);
          expect(normalizedData.bundles.length).toBe(1);
          expect(normalizedData.bundleEntries.length).toBeGreaterThan(0);
        }
      }
    }, timeout);
  });

  describe('Real-World Scenario Tests', () => {
    it('should handle patient care episode workflow', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const endMeasurement = FhirTestPerformance.startMeasurement('care-episode-workflow');

      try {
        // Step 1: Find a patient
        const patientUrl = FhirTestConfig.buildSearchUrl('Patient', {
          [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1
        });
        const patientResponse = await axios.get(patientUrl);
        const patientBundle: IFhirBundle = patientResponse.data;

        if (patientBundle.entry && patientBundle.entry.length > 0) {
          const patient = patientBundle.entry[0].resource;
          expect(patient?.id).toBeDefined();

          // Step 2: Find related encounters for this patient
          const encounterUrl = FhirTestConfig.buildSearchUrl('Encounter', {
            'subject': `Patient/${patient!.id}`,
            [FhirTestConfig.SEARCH_PARAMS.COUNT]: 5
          });

          try {
            const encounterResponse = await axios.get(encounterUrl);
            if (encounterResponse.status === 200) {
              const encounterBundle: IFhirBundle = encounterResponse.data;

              // Step 3: Find observations for the patient
              const observationUrl = FhirTestConfig.buildSearchUrl('Observation', {
                'subject': `Patient/${patient!.id}`,
                [FhirTestConfig.SEARCH_PARAMS.COUNT]: 5
              });

              try {
                const observationResponse = await axios.get(observationUrl);
                if (observationResponse.status === 200) {
                  const observationBundle: IFhirBundle = observationResponse.data;

                  // Combine all resources into a single bundle for normalization
                  const combinedBundle: IFhirBundle = {
                    resourceType: 'Bundle',
                    type: 'collection',
                    entry: [
                      ...(patientBundle.entry || []),
                      ...(encounterBundle.entry || []),
                      ...(observationBundle.entry || [])
                    ]
                  };

                  // Test normalization of the complete care episode
                  const normalizedData = normalizeFhirBundle(combinedBundle);

                  expect(normalizedData.patients.length).toBeGreaterThan(0);
                  expect(normalizedData.bundleEntries.length).toBeGreaterThan(0);

                  // Validate relationships are preserved
                  const normalizedPatient = normalizedData.patients[0];
                  expect(normalizedPatient.resourceId).toBe(patient!.id);
                }
              } catch (obsError) {
                console.warn('Could not fetch observations:', obsError);
              }
            }
          } catch (encError) {
            console.warn('Could not fetch encounters:', encError);
          }
        }
      } finally {
        endMeasurement();
      }
    }, timeout);

    it('should handle large dataset processing efficiently', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const endMeasurement = FhirTestPerformance.startMeasurement('large-dataset-processing');

      try {
        // Request a larger dataset
        const url = FhirTestConfig.buildSearchUrl('Patient', {
          [FhirTestConfig.SEARCH_PARAMS.COUNT]: 50
        });

        const response = await axios.get(url);
        expect(response.status).toBe(200);

        const bundle: IFhirBundle = response.data;

        // Measure normalization performance
        const normalizationStart = performance.now();
        const normalizedData = normalizeFhirBundle(bundle);
        const normalizationTime = performance.now() - normalizationStart;

        // Performance assertions
        expect(normalizationTime).toBeLessThan(5000); // Should complete within 5 seconds

        // Data integrity checks
        expect(normalizedData.bundles.length).toBe(1);
        if (bundle.entry) {
          expect(normalizedData.bundleEntries.length).toBe(bundle.entry.length);
        }

        // Memory usage should be reasonable
        const memoryUsage = process.memoryUsage();
        expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB

      } finally {
        endMeasurement();
      }
    }, timeout);

    it('should handle concurrent requests without data corruption', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const endMeasurement = FhirTestPerformance.startMeasurement('concurrent-requests');

      try {
        const concurrentRequests = 5;
        const requestPromises = Array(concurrentRequests).fill(null).map((_, index) => {
          const url = FhirTestConfig.buildSearchUrl('Patient', {
            [FhirTestConfig.SEARCH_PARAMS.COUNT]: 3,
            '_offset': index * 3 // Try to get different patients
          });
          return axios.get(url);
        });

        const responses = await Promise.all(requestPromises);

        // All requests should succeed
        responses.forEach((response, index) => {
          expect(response.status).toBe(200);

          const bundle: IFhirBundle = response.data;
          FhirTestConfig.validateFhirBundle(bundle);

          // Test normalization doesn't interfere between concurrent operations
          const normalizedData = normalizeFhirBundle(bundle);
          expect(normalizedData.bundles.length).toBe(1);
          expect(normalizedData.bundles[0].resourceId).toBe(bundle.id);
        });

      } finally {
        endMeasurement();
      }
    }, timeout);
  });

  describe('Error Handling and Resilience Tests', () => {
    it('should handle server errors gracefully', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const errorScenarios = FhirTestConfig.getTestPatterns().errorScenarios;

      for (const scenario of errorScenarios) {
        try {
          await axios.get(scenario.url);
          // If no error is thrown, the server might have different behavior
        } catch (error: any) {
          expect(error.response?.status).toBe(scenario.expectedStatus);
        }
      }
    });

    it('should retry failed requests with backoff', async () => {
      const endMeasurement = FhirTestPerformance.startMeasurement('retry-with-backoff');

      try {
        let attemptCount = 0;

        const result = await FhirTestConfig.retry(async () => {
          attemptCount++;

          // Simulate intermittent failure
          if (attemptCount < 2) {
            throw new Error('Simulated network error');
          }

          // Make real request on final attempt
          const axios = FhirTestConfig.getAxiosInstance();
          const url = FhirTestConfig.buildSearchUrl('Patient', {
            [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1
          });
          return await axios.get(url);
        }, 3, 100);

        expect(result.status).toBe(200);
        expect(attemptCount).toBe(2);

      } finally {
        endMeasurement();
      }
    });

    it('should handle malformed responses without crashing', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      // Get a valid bundle first
      const url = FhirTestConfig.buildSearchUrl('Patient', {
        [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1
      });
      const response = await axios.get(url);
      const validBundle: IFhirBundle = response.data;

      // Test with various malformed scenarios
      const malformedBundles = [
        { ...validBundle, resourceType: undefined },
        { ...validBundle, entry: null },
        { ...validBundle, entry: [{ resource: null }] },
        { resourceType: 'Bundle', type: 'searchset' }, // Minimal bundle
      ];

      for (const malformedBundle of malformedBundles) {
        expect(() => {
          normalizeFhirBundle(malformedBundle as any);
        }).not.toThrow();
      }
    });
  });

  describe('Search Parameter Validation Tests', () => {
    it('should validate common search parameters work correctly', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const testPatterns: Record<string, string | number>[] = [
        { _count: 5 },
        { _count: 1 },
        { _count: 10 },
      ];

      for (const pattern of testPatterns) {
        try {
          const url = FhirTestConfig.buildSearchUrl('Patient', pattern);
          const response = await axios.get(url);

          expect(response.status).toBe(200);
          const bundle: IFhirBundle = response.data;
          FhirTestConfig.validateFhirBundle(bundle);

          // Validate count parameter is respected
          if (pattern._count) {
            const expectedCount = Number(pattern._count);
            if (bundle.entry) {
              expect(bundle.entry.length).toBeLessThanOrEqual(expectedCount);
            }
          }
        } catch (error: any) {
          // Skip if server has issues with this search pattern
          if (error.response?.status >= 500) {
            console.warn(`Server error with pattern ${JSON.stringify(pattern)}: ${error.response.status}`);
          } else {
            throw error;
          }
        }
      }
    }, timeout);

    it('should handle complex search queries', async () => {
      const axios = FhirTestConfig.getAxiosInstance();
      const complexQueries: Record<string, string | number>[] = [
        { 'gender': 'male', '_count': 5 },
        { 'active': 'true', '_count': 3 },
        { 'birthdate': 'gt1950-01-01', '_count': 2 },
      ];

      for (const query of complexQueries) {
        const url = FhirTestConfig.buildSearchUrl('Patient', query);

        try {
          const response = await axios.get(url);
          if (response.status === 200) {
            const bundle: IFhirBundle = response.data;
            FhirTestConfig.validateFhirBundle(bundle);

            // Test normalization with filtered results
            const normalizedData = normalizeFhirBundle(bundle);
            expect(normalizedData.bundles.length).toBe(1);
          }
        } catch (error: any) {
          // Some servers might not support all search parameters
          if (error.response?.status !== 400) {
            throw error;
          }
        }
      }
    }, timeout);
  });
});
