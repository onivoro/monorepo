# @onivoro/isomorphic-fhir

A library for transforming FHIR (Fast Healthcare Interoperability Resources) bundles into normalized database tables following Third Normal Form (3NF).

## Overview

This library takes FHIR R4 bundles containing healthcare resources and transforms them into a set of normalized tables that can be used to populate a relational database. The transformation process:

- Eliminates data redundancy across FHIR resources
- Ensures referential integrity between healthcare entities
- Creates proper foreign key relationships
- Generates unique IDs for normalized records
- Preserves FHIR resource relationships through reference tables
- Handles complex nested structures like CodeableConcepts and Extensions

## Supported FHIR Resources

The library currently supports normalization of the following FHIR R4 resources:

- **Patient**: Demographics, identifiers, names, contacts, addresses
- **Practitioner**: Healthcare providers, qualifications, contact information
- **Organization**: Healthcare organizations, types, contact details
- **Encounter**: Healthcare encounters, participants, locations
- **Condition**: Medical conditions, clinical status, evidence
- **Observation**: Clinical measurements, vital signs, lab results
- **MedicationRequest**: Medication prescriptions, dosage instructions
- **Procedure**: Medical procedures, performers, outcomes
- **Immunization**: Vaccinations, reactions, protocols
- **AllergyIntolerance**: Allergies, reactions, manifestations
- **DiagnosticReport**: Diagnostic test results, conclusions
- **Location**: Healthcare facilities, positions, contact info
- **Appointment**: Scheduled appointments, participants
- **CareTeam**: Care team members, roles, periods
- **CarePlan**: Care plans, activities, goals

## Usage

```typescript
import { normalizeFhirBundle } from '@onivoro/isomorphic-fhir';

const fhirBundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
        birthDate: '1985-03-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'observation-456',
        status: 'final',
        code: { coding: [{ code: '8867-4', display: 'Heart rate' }] },
        subject: { reference: 'Patient/patient-123' },
        valueQuantity: { value: 72, unit: 'beats/min' }
      }
    }
  ]
};

const normalizedData = normalizeFhirBundle(fhirBundle);

// normalizedData contains normalized tables:
console.log(normalizedData.patients);      // Patient demographics
console.log(normalizedData.patientNames);  // Patient names (separate table)
console.log(normalizedData.observations);  // Clinical observations
console.log(normalizedData.addresses);     // Addresses (deduplicated)
console.log(normalizedData.telecoms);      // Contact points
console.log(normalizedData.references);    // Resource relationships
```

## Normalized Tables Generated

The library generates 30+ normalized tables following healthcare data patterns:

### Core Resource Tables
- **bundles**: FHIR bundle metadata
- **bundleEntries**: Bundle entry information
- **patients**: Patient demographics
- **practitioners**: Healthcare provider information
- **organizations**: Healthcare organizations
- **encounters**: Healthcare encounters
- **conditions**: Medical conditions and diagnoses
- **observations**: Clinical measurements and findings
- **medicationRequests**: Medication prescriptions
- **procedures**: Medical procedures performed
- **immunizations**: Vaccination records
- **allergyIntolerances**: Allergy and intolerance information
- **diagnosticReports**: Diagnostic test reports
- **locations**: Healthcare facility information
- **appointments**: Scheduled appointments
- **careTeams**: Care team compositions
- **carePlans**: Patient care plans

### Relationship and Detail Tables
- **patientIdentifiers**: Patient identifier systems
- **patientNames**: Patient name variations
- **patientContacts**: Emergency/family contacts
- **practitionerQualifications**: Provider credentials
- **organizationTypes**: Organization classifications
- **encounterParticipants**: Encounter participants
- **observationComponents**: Multi-component observations
- **medicationDosages**: Medication dosing instructions
- **procedurePerformers**: Procedure performers
- **allergyReactions**: Allergic reactions
- **allergyManifestations**: Reaction manifestations
- **diagnosticReportResults**: Report result references
- **appointmentParticipants**: Appointment participants
- **careTeamParticipants**: Care team member details
- **carePlanActivities**: Care plan activity details

### Common Data Type Tables
- **addresses**: Physical addresses (deduplicated)
- **telecoms**: Contact points (phone, email, etc.)
- **codeableConcepts**: Coded concepts with text
- **codings**: Individual coding systems
- **notes**: Annotations and comments
- **attachments**: Binary attachments and documents
- **references**: Resource references and relationships

## Key Features

### FHIR Compliance
- Full FHIR R4 resource support
- Proper handling of FHIR data types (CodeableConcept, Reference, etc.)
- Preservation of clinical terminology and coding systems
- Support for complex nested structures

### Data Integrity
- Referential integrity through normalized foreign keys
- Unique constraint handling for identifiers
- Proper temporal data handling (effective periods, timestamps)
- Clinical status and verification status preservation

### Healthcare-Specific Patterns
- Support for multiple identifier systems per resource
- Proper handling of clinical hierarchies (conditions, observations)
- Care team and care plan relationship modeling
- Medication dosing and administration patterns
- Allergy and adverse reaction tracking

### Performance Optimized
- Efficient deduplication of common entities (addresses, codings)
- Bulk insert-friendly table structures
- Indexed foreign key relationships
- Minimal data redundancy

## Testing

The library includes comprehensive tests covering:
- Complete FHIR bundle normalization
- Individual resource type processing
- Complex nested structure handling
- Reference relationship preservation
- Edge cases and error conditions

Run tests with:
```bash
nx test lib-isomorphic-fhir
```

## FHIR Standards Compliance

This library is designed to work with FHIR R4 resources and follows HL7 FHIR standards for:
- Resource structure and cardinality
- Data type handling and validation
- Reference resolution and integrity
- Clinical terminology bindings
- Healthcare workflow patterns

## Use Cases

Perfect for:
- **EHR Data Warehousing**: Normalize FHIR data for analytics
- **Clinical Data Lakes**: Store FHIR resources in relational format
- **Interoperability Solutions**: Transform FHIR for legacy systems
- **Healthcare Analytics**: Enable SQL-based analysis of clinical data
- **Compliance Reporting**: Structure data for regulatory requirements
- **Research Databases**: Prepare clinical data for research queries

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.