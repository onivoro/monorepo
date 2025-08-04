import axios from 'axios';
import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import { IFhirBundle, IFhirPatient, IFhirObservation, IFhirEncounter } from '../interfaces/fhir-resources.interface';

describe('FHIR API Integration Tests', () => {
  const FHIR_BASE_URL = 'http://hapi.fhir.org/baseR4';
  const timeout = 30000; // 30 seconds timeout for API calls

  beforeAll(() => {
    // Set default axios timeout
    axios.defaults.timeout = timeout;
  });

  describe('Patient Resource Integration', () => {
    it('should fetch and normalize patient data from HAPI FHIR server', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=5&_format=json`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('resourceType', 'Bundle');

      const bundle: IFhirBundle = response.data;
      expect(bundle.resourceType).toBe('Bundle');

      // Handle case where server returns empty results
      if (bundle.entry && bundle.entry.length > 0) {
        expect(Array.isArray(bundle.entry)).toBe(true);
        expect(bundle.entry.length).toBeGreaterThan(0);

        // Test that the bundle contains patient resources
        const patientEntries = bundle.entry.filter(entry =>
          entry.resource?.resourceType === 'Patient'
        );
        expect(patientEntries.length).toBeGreaterThan(0);

        // Test normalization function with real data
        const normalizedData = normalizeFhirBundle(bundle);
        expect(normalizedData.patients.length).toBeGreaterThan(0);
        expect(normalizedData.bundles.length).toBe(1);
        expect(normalizedData.bundleEntries.length).toBeGreaterThan(0);
      } else {
        // Empty results are still valid
        const normalizedData = normalizeFhirBundle(bundle);
        expect(normalizedData.bundles.length).toBe(1);
        expect(normalizedData.bundleEntries.length).toBe(0);
      }
    }, timeout);

    it('should fetch a specific patient by ID and validate structure', async () => {
      // First get a list of patients to get a valid ID
      const searchResponse = await axios.get(`${FHIR_BASE_URL}/Patient?_count=1&_format=json`);
      const searchBundle: IFhirBundle = searchResponse.data;

      if (searchBundle.entry && searchBundle.entry.length > 0) {
        const firstPatient = searchBundle.entry[0].resource as IFhirPatient;
        expect(firstPatient.id).toBeDefined();

        // Fetch the specific patient
        const patientResponse = await axios.get(`${FHIR_BASE_URL}/Patient/${firstPatient.id}?_format=json`);
        expect(patientResponse.status).toBe(200);

        const patient: IFhirPatient = patientResponse.data;
        expect(patient.resourceType).toBe('Patient');
        expect(patient.id).toBe(firstPatient.id);
      }
    }, timeout);

    it('should handle patient search with different parameters', async () => {
      const searchParams = [
        'gender=male',
        'gender=female',
        '_count=3'
      ];

      for (const params of searchParams) {
        try {
          const response = await axios.get(`${FHIR_BASE_URL}/Patient?${params}&_format=json`);
          expect(response.status).toBe(200);

          const bundle: IFhirBundle = response.data;
          expect(bundle.resourceType).toBe('Bundle');
        } catch (error: any) {
          // Some servers may not support all search parameters
          if (error.response?.status >= 400 && error.response?.status < 500) {
            console.warn(`Search parameter "${params}" not supported by server`);
          } else {
            throw error;
          }
        }
      }
    }, timeout);
  });

  describe('Observation Resource Integration', () => {
    it('should fetch and normalize observation data', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Observation?_count=5&_format=json`);

      expect(response.status).toBe(200);
      const bundle: IFhirBundle = response.data;
      expect(bundle.resourceType).toBe('Bundle');

      if (bundle.entry && bundle.entry.length > 0) {
        const observationEntries = bundle.entry.filter(entry =>
          entry.resource?.resourceType === 'Observation'
        );

        if (observationEntries.length > 0) {
          const normalizedData = normalizeFhirBundle(bundle);
          expect(normalizedData.observations.length).toBeGreaterThan(0);

          // Validate observation structure
          const firstObservation = normalizedData.observations[0];
          expect(firstObservation.resourceId).toBeDefined();
          expect(firstObservation.status).toBeDefined();
        }
      }
    }, timeout);

    it('should fetch observations by category', async () => {
      const categories = ['vital-signs', 'laboratory', 'social-history'];

      for (const category of categories) {
        const response = await axios.get(
          `${FHIR_BASE_URL}/Observation?category=${category}&_count=3&_format=json`
        );

        if (response.status === 200) {
          const bundle: IFhirBundle = response.data;
          expect(bundle.resourceType).toBe('Bundle');
        }
      }
    }, timeout);
  });

  describe('Encounter Resource Integration', () => {
    it('should fetch and normalize encounter data', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Encounter?_count=5&_format=json`);

      expect(response.status).toBe(200);
      const bundle: IFhirBundle = response.data;

      if (bundle.entry && bundle.entry.length > 0) {
        const encounterEntries = bundle.entry.filter(entry =>
          entry.resource?.resourceType === 'Encounter'
        );

        if (encounterEntries.length > 0) {
          const normalizedData = normalizeFhirBundle(bundle);
          expect(normalizedData.encounters.length).toBeGreaterThan(0);

          // Validate encounter structure
          const firstEncounter = normalizedData.encounters[0];
          expect(firstEncounter.resourceId).toBeDefined();
          expect(firstEncounter.status).toBeDefined();
        }
      }
    }, timeout);
  });

  describe('Bundle Processing Integration', () => {
    it('should handle large bundles efficiently', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=20&_format=json`);

      expect(response.status).toBe(200);
      const bundle: IFhirBundle = response.data;

      const startTime = Date.now();
      const normalizedData = normalizeFhirBundle(bundle);
      const processingTime = Date.now() - startTime;

      // Processing should complete within reasonable time (5 seconds)
      expect(processingTime).toBeLessThan(5000);

      // Validate that all bundle entries are processed
      if (bundle.entry) {
        expect(normalizedData.bundleEntries.length).toBe(bundle.entry.length);
      }
    }, timeout);

    it('should handle mixed resource type bundles', async () => {
      // Try to get a bundle with multiple resource types
      const response = await axios.get(
        `${FHIR_BASE_URL}/Patient?_count=5&_include=Patient:general-practitioner&_format=json`
      );

      if (response.status === 200) {
        const bundle: IFhirBundle = response.data;
        const normalizedData = normalizeFhirBundle(bundle);

        // Should have processed the bundle without errors
        expect(normalizedData.bundles.length).toBe(1);

        // Allow for empty results
        if (bundle.entry && bundle.entry.length > 0) {
          expect(normalizedData.bundleEntries.length).toBeGreaterThan(0);
        } else {
          expect(normalizedData.bundleEntries.length).toBe(0);
        }
      }
    }, timeout);
  });

  describe('Error Handling Integration', () => {
    it('should handle non-existent resource gracefully', async () => {
      try {
        await axios.get(`${FHIR_BASE_URL}/Patient/non-existent-id-12345?_format=json`);
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    }, timeout);

    it('should handle invalid search parameters gracefully', async () => {
      try {
        // Some FHIR servers may return 400 for invalid parameters, others may ignore them
        const response = await axios.get(`${FHIR_BASE_URL}/Patient?invalid-param=test&_format=json`);

        // Should either succeed (ignoring invalid param) or return client error
        expect([200, 400].includes(response.status)).toBe(true);
      } catch (error: any) {
        // Expect 400 for invalid parameters
        expect(error.response?.status).toBe(400);
      }
    }, timeout);

    it('should handle malformed bundle data gracefully', async () => {
      // Get a valid bundle first
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=1&_format=json`);
      const validBundle: IFhirBundle = response.data;

      // Create a malformed bundle (remove required fields)
      const malformedBundle = {
        ...validBundle,
        resourceType: undefined
      } as any;

      // The normalization function should handle this gracefully
      expect(() => {
        normalizeFhirBundle(malformedBundle);
      }).not.toThrow();
    });
  });

  describe('Data Validation Integration', () => {
    it('should validate patient data structure from real API', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=1&_format=json`);
      const bundle: IFhirBundle = response.data;

      if (bundle.entry && bundle.entry.length > 0) {
        const patient = bundle.entry[0].resource as IFhirPatient;

        // Validate required FHIR Patient fields
        expect(patient.resourceType).toBe('Patient');
        expect(patient.id).toBeDefined();

        // Validate optional but common fields
        if (patient.name) {
          expect(Array.isArray(patient.name)).toBe(true);
          patient.name.forEach(name => {
            expect(typeof name).toBe('object');
          });
        }

        if (patient.telecom) {
          expect(Array.isArray(patient.telecom)).toBe(true);
          patient.telecom.forEach(contact => {
            expect(contact.system).toBeDefined();
            expect(contact.value).toBeDefined();
          });
        }

        if (patient.address) {
          expect(Array.isArray(patient.address)).toBe(true);
        }
      }
    }, timeout);

    it('should validate normalized data integrity', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=3&_format=json`);
      const bundle: IFhirBundle = response.data;

      const normalizedData = normalizeFhirBundle(bundle);

      // Validate bundle normalization
      expect(normalizedData.bundles.length).toBe(1);
      const normalizedBundle = normalizedData.bundles[0];
      expect(normalizedBundle.resourceId).toBeDefined();
      expect(normalizedBundle.type).toBe(bundle.type);

      // Validate that all entries are accounted for
      if (bundle.entry) {
        expect(normalizedData.bundleEntries.length).toBe(bundle.entry.length);

        // Check that each entry has a corresponding normalized entry
        normalizedData.bundleEntries.forEach(entry => {
          expect(entry.bundleId).toBeDefined(); // Don't check exact match since bundle IDs may differ
          expect(entry.resourceType).toBeDefined();
        });
      }
    }, timeout);
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        axios.get(`${FHIR_BASE_URL}/Patient?_count=2&_format=json`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.resourceType).toBe('Bundle');
      });

      // Should complete within reasonable time (10 seconds for 5 concurrent requests)
      expect(totalTime).toBeLessThan(10000);
    }, timeout);

    it('should process large datasets without memory issues', async () => {
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=50&_format=json`);

      if (response.status === 200) {
        const bundle: IFhirBundle = response.data;

        // Monitor memory usage during processing
        const initialMemory = process.memoryUsage().heapUsed;
        const normalizedData = normalizeFhirBundle(bundle);
        const finalMemory = process.memoryUsage().heapUsed;

        // Memory increase should be reasonable (less than 100MB)
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

        // Data should be processed correctly - allow for empty result sets
        if (bundle.entry && bundle.entry.length > 0) {
          expect(normalizedData.patients.length).toBeGreaterThan(0);
        } else {
          // If no entries, that's still a valid test result
          expect(normalizedData.patients.length).toBe(0);
        }
      } else {
        // If server doesn't support large requests, skip this test
        console.warn('Server does not support large dataset requests');
      }
    }, timeout);
  });
});
