# FHIR Library Integration Tests

This document describes the integration tests for the FHIR library that test against the public HAPI FHIR server at `http://hapi.fhir.org/baseR4`.

## Overview

The integration tests validate that the FHIR library correctly:
- Fetches real FHIR data from the HAPI test server
- Normalizes FHIR bundles and resources into structured tables
- Handles various FHIR resource types (Patient, Practitioner, Organization, etc.)
- Processes search parameters and pagination
- Manages error conditions and edge cases
- Performs efficiently with real-world data volumes

## Test Structure

### Core Integration Tests (`fhir-api-integration.spec.ts`)
- **Patient Resource Integration**: Tests patient data fetching and normalization
- **Observation Resource Integration**: Tests observation data processing
- **Encounter Resource Integration**: Tests encounter data handling
- **Bundle Processing Integration**: Tests bundle normalization efficiency
- **Error Handling Integration**: Tests graceful error handling
- **Data Validation Integration**: Validates data structure integrity
- **Performance Integration**: Tests concurrent requests and memory usage

### Resource-Specific Tests (`fhir-resource-types-integration.spec.ts`)
- **Practitioner Resource Tests**: Practitioner data and qualifications
- **Organization Resource Tests**: Organization data and hierarchies
- **Location Resource Tests**: Location data processing
- **Condition Resource Tests**: Condition data and clinical status
- **MedicationRequest Resource Tests**: Medication requests and dosages
- **Procedure Resource Tests**: Procedure data and performers
- **Cross-Resource Relationships**: Tests resource references and relationships
- **Search Parameter Integration**: Tests various search patterns
- **Pagination Integration**: Tests result pagination and navigation

### Server Capabilities Tests (`fhir-server-capabilities-integration.spec.ts`)
- **Server Capability Tests**: Validates server metadata and capabilities
- **Resource Discovery Tests**: Discovers available resources dynamically
- **Real-World Scenario Tests**: Tests complete care episode workflows
- **Error Handling and Resilience**: Tests retry mechanisms and error recovery
- **Search Parameter Validation**: Tests complex search queries

## Configuration

### Test Configuration (`fhir-test-config.ts`)
Provides utilities for:
- Building FHIR URLs with search parameters
- Common test patterns and scenarios
- Performance monitoring
- Server availability checking
- Retry mechanisms with backoff

### Test Setup (`test-setup.ts`)
Configures:
- Global test timeouts (30 seconds)
- Axios defaults for FHIR requests
- Custom Jest matchers for FHIR resources
- Server availability checking
- Error handling setup

## Running the Tests

### Prerequisites
- Node.js and npm/yarn installed
- Internet connection to reach `http://hapi.fhir.org/baseR4`
- Jest testing framework configured

### Running All Tests
```bash
# Run all FHIR library tests (including integration tests)
npm run test libs/isomorphic/fhir

# Or using nx
nx test lib-isomorphic-fhir
```

### Running Specific Test Suites
```bash
# Run only API integration tests
npx jest fhir-api-integration.spec.ts

# Run only resource type tests
npx jest fhir-resource-types-integration.spec.ts

# Run only server capabilities tests
npx jest fhir-server-capabilities-integration.spec.ts
```

### Running with Coverage
```bash
nx test lib-isomorphic-fhir --coverage
```

## Test Data

The tests use real data from the HAPI FHIR test server, which contains:
- Sample patient records
- Synthetic clinical observations
- Practitioner and organization data
- Encounter records
- Medication and procedure data

**Note**: The HAPI test server is publicly available and data may change. Tests are designed to be flexible and handle variations in available data.

## Performance Expectations

The tests include performance benchmarks:
- Single resource fetching: < 5 seconds
- Bundle normalization: < 5 seconds for 50 resources
- Concurrent requests: 5 parallel requests < 10 seconds
- Memory usage: < 500MB heap for large datasets

## Error Handling

Tests validate proper handling of:
- Network timeouts and connection errors
- HTTP 404 (resource not found) responses
- HTTP 400 (bad request) responses for invalid parameters
- Malformed FHIR data structures
- Server unavailability

## Troubleshooting

### Server Unavailable
If `http://hapi.fhir.org/baseR4` is unavailable:
- Tests will log warnings but may continue with available data
- Check the HAPI FHIR server status
- Verify internet connectivity
- Some tests may be skipped automatically

### Timeout Issues
If tests timeout frequently:
- Check network connectivity
- Increase timeout in `jest.config.ts` if needed
- The HAPI server may be under heavy load

### Memory Issues
If tests fail with memory errors:
- Increase Node.js heap size: `node --max-old-space-size=4096`
- Check for memory leaks in normalization logic
- Reduce test data set sizes

## Contributing

When adding new integration tests:

1. **Use the FhirTestConfig utility** for consistent URL building and server checks
2. **Include performance measurements** using FhirTestPerformance
3. **Handle server unavailability gracefully** - don't fail if the server is down
4. **Test both success and error scenarios**
5. **Validate normalized data structure** after processing FHIR bundles
6. **Use appropriate timeouts** (30 seconds default)
7. **Clean up any test data** if the server supports it

### Test Naming Convention
- Use descriptive test names that explain what is being validated
- Group related tests in `describe` blocks
- Use `it.skip()` for tests that should be temporarily disabled
- Use `it.only()` for debugging specific tests (remove before committing)

### Performance Testing
- Measure operation durations using `FhirTestPerformance.startMeasurement()`
- Set reasonable performance expectations based on data size
- Test memory usage for large datasets
- Include concurrent operation tests

## Continuous Integration

These integration tests are designed to run in CI/CD pipelines:
- Tests check server availability before running
- Graceful degradation when external services are unavailable
- Reasonable timeouts to prevent CI job hangs
- Performance benchmarks to catch regressions

## Security Considerations

- Tests only read public test data from the HAPI server
- No authentication credentials are stored in the codebase
- No patient privacy concerns as data is synthetic
- Tests do not attempt to modify server data (read-only operations)
