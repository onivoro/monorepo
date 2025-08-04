import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';

/**
 * Configuration and utilities for FHIR API integration tests
 */
export class FhirTestConfig {
  public static readonly FHIR_BASE_URL = 'http://hapi.fhir.org/baseR4';
  public static readonly TEST_TIMEOUT = 30000;

  // Create a dedicated axios instance for testing with proper cleanup
  private static testAxiosInstance: AxiosInstance;

  /**
   * Get or create the test axios instance
   */
  public static getAxiosInstance(): AxiosInstance {
    if (!this.testAxiosInstance) {
      // Create HTTP/HTTPS agents that don't keep connections alive
      const httpAgent = new http.Agent({
        keepAlive: false,
        maxSockets: 5
      });
      const httpsAgent = new https.Agent({
        keepAlive: false,
        maxSockets: 5
      });

      this.testAxiosInstance = axios.create({
        timeout: this.TEST_TIMEOUT,
        httpAgent,
        httpsAgent,
        headers: {
          'Accept': 'application/fhir+json',
          'Connection': 'close'
        }
      });
    }
    return this.testAxiosInstance;
  }

  /**
   * Clean up the axios instance
   */
  public static cleanup(): void {
    if (this.testAxiosInstance) {
      // Destroy any remaining connections
      if (this.testAxiosInstance.defaults.httpAgent) {
        this.testAxiosInstance.defaults.httpAgent.destroy();
      }
      if (this.testAxiosInstance.defaults.httpsAgent) {
        this.testAxiosInstance.defaults.httpsAgent.destroy();
      }
    }
  }

  /**
   * Common FHIR resource types for testing
   */
  public static readonly RESOURCE_TYPES = {
    PATIENT: 'Patient',
    PRACTITIONER: 'Practitioner',
    ORGANIZATION: 'Organization',
    ENCOUNTER: 'Encounter',
    OBSERVATION: 'Observation',
    CONDITION: 'Condition',
    MEDICATION_REQUEST: 'MedicationRequest',
    PROCEDURE: 'Procedure',
    LOCATION: 'Location',
    APPOINTMENT: 'Appointment',
    CARE_TEAM: 'CareTeam',
    CARE_PLAN: 'CarePlan',
    IMMUNIZATION: 'Immunization',
    ALLERGY_INTOLERANCE: 'AllergyIntolerance',
    DIAGNOSTIC_REPORT: 'DiagnosticReport'
  } as const;

  /**
   * Common search parameters for testing
   */
  public static readonly SEARCH_PARAMS = {
    COUNT: '_count',
    FORMAT: '_format',
    INCLUDE: '_include',
    SORT: '_sort',
    TEXT: '_text'
  } as const;

  /**
   * Initialize axios defaults for testing
   */
  public static initializeAxios(): void {
    // Just ensure our test instance is created
    this.getAxiosInstance();
  }

  /**
   * Build a FHIR search URL with parameters
   */
  public static buildSearchUrl(resourceType: string, params: Record<string, string | number> = {}): string {
    const url = new URL(`${this.FHIR_BASE_URL}/${resourceType}`);

    // Add default format parameter
    url.searchParams.set(this.SEARCH_PARAMS.FORMAT, 'json');

    // Add custom parameters, filtering out undefined values
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });

    return url.toString();
  }

  /**
   * Get a resource by ID
   */
  public static buildResourceUrl(resourceType: string, id: string): string {
    return `${this.FHIR_BASE_URL}/${resourceType}/${id}?_format=json`;
  }

  /**
   * Common assertion helpers for FHIR resources
   */
  public static validateFhirResource(resource: any, expectedType: string): void {
    expect(resource).toBeDefined();
    expect(resource.resourceType).toBe(expectedType);
    expect(resource.id).toBeDefined();
  }

  /**
   * Validate FHIR Bundle structure
   */
  public static validateFhirBundle(bundle: any): void {
    expect(bundle).toBeDefined();
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBeDefined();
    expect(['searchset', 'collection', 'document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history'].includes(bundle.type)).toBe(true);
  }

  /**
   * Wait for a condition to be met (useful for async operations)
   */
  public static async waitFor(condition: () => boolean | Promise<boolean>, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Retry a function with exponential backoff
   */
  public static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        const delay = initialDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Check if the FHIR server is available
   */
  public static async checkServerAvailability(): Promise<boolean> {
    try {
      const axiosInstance = this.getAxiosInstance();
      const response = await axiosInstance.get(`${this.FHIR_BASE_URL}/metadata`, { timeout: 5000 });
      return response.status === 200 && response.data.resourceType === 'CapabilityStatement';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get server capability statement
   */
  public static async getServerCapabilities(): Promise<any> {
    const axiosInstance = this.getAxiosInstance();
    const response = await axiosInstance.get(`${this.FHIR_BASE_URL}/metadata?_format=json`);
    return response.data;
  }

  /**
   * Clean up test data (if the server supports it)
   */
  /**
   * Clean up test data (placeholder - HAPI test server doesn't support DELETE)
   */
  public static async cleanupTestData(resourceType: string, identifiers: string[]): Promise<void> {
    // Note: HAPI FHIR test server typically doesn't allow DELETE operations
    // This is a placeholder for when testing against a server that does support cleanup
    const axiosInstance = this.getAxiosInstance();
    for (const id of identifiers) {
      try {
        await axiosInstance.delete(`${this.FHIR_BASE_URL}/${resourceType}/${id}`);
      } catch (error) {
        // Ignore errors during cleanup as test servers may not support DELETE
        console.warn(`Could not delete ${resourceType}/${id}:`, error);
      }
    }
  }

  /**
   * Generate test data patterns
   */
  public static getTestPatterns() {
    return {
      // Common search patterns to test
      searchPatterns: [
        { params: { [FhirTestConfig.SEARCH_PARAMS.COUNT]: 5 } },
        { params: { [FhirTestConfig.SEARCH_PARAMS.COUNT]: 1 } },
        { params: { [FhirTestConfig.SEARCH_PARAMS.COUNT]: 10, [FhirTestConfig.SEARCH_PARAMS.SORT]: 'name' } },
      ],

      // Resource type combinations for mixed bundles
      resourceCombinations: [
        [FhirTestConfig.RESOURCE_TYPES.PATIENT, FhirTestConfig.RESOURCE_TYPES.ENCOUNTER],
        [FhirTestConfig.RESOURCE_TYPES.PRACTITIONER, FhirTestConfig.RESOURCE_TYPES.ORGANIZATION],
        [FhirTestConfig.RESOURCE_TYPES.PATIENT, FhirTestConfig.RESOURCE_TYPES.OBSERVATION],
      ],

      // Error scenarios to test
      errorScenarios: [
        { url: `${FhirTestConfig.FHIR_BASE_URL}/Patient/non-existent-id-123456`, expectedStatus: 404 },
        { url: `${FhirTestConfig.FHIR_BASE_URL}/InvalidResourceType`, expectedStatus: 404 },
      ]
    };
  }
}

/**
 * Test utilities for performance monitoring
 */
export class FhirTestPerformance {
  private static measurements: Map<string, number[]> = new Map();

  public static startMeasurement(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMeasurement(name, duration);
      return duration;
    };
  }

  public static recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
  }

  public static getStatistics(name: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }

  public static reset(): void {
    this.measurements.clear();
  }

  public static logStatistics(): void {
    for (const [name, measurements] of this.measurements.entries()) {
      const stats = this.getStatistics(name);
      if (stats) {
        console.log(`${name}: avg=${stats.avg.toFixed(2)}ms, min=${stats.min.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms, count=${stats.count}`);
      }
    }
  }
}
