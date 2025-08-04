import axios from 'axios';
import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import { IFhirBundle } from '../interfaces/fhir-resources.interface';

describe('Basic FHIR Integration Test', () => {
  const FHIR_BASE_URL = 'http://hapi.fhir.org/baseR4';
  const timeout = 30000;

  beforeAll(() => {
    axios.defaults.timeout = timeout;
  });

  it('should successfully fetch and normalize patient data from HAPI FHIR server', async () => {
    // Test server availability first
    let serverAvailable = true;
    try {
      const healthCheck = await axios.get(`${FHIR_BASE_URL}/metadata?_format=json`, { timeout: 5000 });
      expect(healthCheck.status).toBe(200);
      expect(healthCheck.data.resourceType).toBe('CapabilityStatement');
    } catch (error) {
      console.warn('FHIR server health check failed:', error);
      serverAvailable = false;
    }

    if (!serverAvailable) {
      console.warn('Skipping integration test - FHIR server not available');
      return;
    }

    // Fetch patient data
    const response = await axios.get(`${FHIR_BASE_URL}/Patient?_count=3&_format=json`);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('resourceType', 'Bundle');

    const bundle: IFhirBundle = response.data;
    expect(bundle.resourceType).toBe('Bundle');

    // Handle case where server returns empty results
    if (bundle.entry && bundle.entry.length > 0) {
      expect(Array.isArray(bundle.entry)).toBe(true);
    }

    // Test normalization function with real data
    const normalizedData = normalizeFhirBundle(bundle);
    expect(normalizedData).toBeDefined();
    expect(normalizedData.bundles.length).toBe(1);
    expect(normalizedData.bundleEntries.length).toBeGreaterThanOrEqual(0);

    // If there are patients in the response, validate they are normalized correctly
    if (bundle.entry && bundle.entry.length > 0) {
      const patientEntries = bundle.entry.filter(entry =>
        entry.resource?.resourceType === 'Patient'
      );

      if (patientEntries.length > 0) {
        expect(normalizedData.patients.length).toBeGreaterThan(0);

        // Validate first patient structure
        const firstPatient = normalizedData.patients[0];
        expect(firstPatient.id).toBeDefined();
        expect(firstPatient.resourceId).toBeDefined();
      }
    }

    console.log(`✅ Successfully processed FHIR bundle with ${bundle.entry?.length || 0} entries`);
    console.log(`✅ Normalized into ${normalizedData.patients.length} patients`);
  }, timeout);

  it('should handle empty or small result sets gracefully', async () => {
    try {
      // Try to find a resource that may not exist
      const response = await axios.get(`${FHIR_BASE_URL}/Patient?name=ThisNameProbablyDoesNotExist&_count=1&_format=json`);

      expect(response.status).toBe(200);
      const bundle: IFhirBundle = response.data;
      expect(bundle.resourceType).toBe('Bundle');

      // Should handle empty results gracefully
      const normalizedData = normalizeFhirBundle(bundle);
      expect(normalizedData.bundles.length).toBe(1);

      if (bundle.entry && bundle.entry.length === 0) {
        console.log('✅ Handled empty result set gracefully');
      } else {
        console.log('✅ Handled small result set gracefully');
      }
    } catch (error: any) {
      // Some servers might return errors for invalid searches
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.log('✅ Handled server error gracefully');
      } else {
        throw error;
      }
    }
  }, timeout);

  it('should validate library exports are working correctly', () => {
    // Test that the function can be imported and called
    expect(typeof normalizeFhirBundle).toBe('function');

    // Test with a minimal valid bundle
    const minimalBundle: IFhirBundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: []
    };

    const result = normalizeFhirBundle(minimalBundle);
    expect(result).toBeDefined();
    expect(result.bundles.length).toBe(1);
    expect(result.bundleEntries.length).toBe(0);

    console.log('✅ Library exports are working correctly');
  });
});
