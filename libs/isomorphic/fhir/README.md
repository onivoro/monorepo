# @onivoro/isomorphic-fhir

A library for flattening FHIR (Fast Healthcare Interoperability Resources) R4 bundles into a set of relational-style tables (plain arrays of row objects), plus TypeScript interfaces for the supported FHIR resources and the generated tables.

## Installation

```bash
npm install @onivoro/isomorphic-fhir
```

## Overview

`normalizeFhirBundle` walks a bundle's entries and splits each supported resource into a main row plus child rows for its repeating and nested parts. Along the way it:

- Generates a new UUID (v4) `id` for every row and links child rows to their parent through that id (e.g. `patientNames[].patientId`, `codings[].codeableConceptId`)
- Keeps the original FHIR `id` in `resourceId` on main rows
- Stores shared data types (addresses, telecoms, CodeableConcepts and codings, notes, attachments, references) in generic tables keyed by `resourceType` + `resourceId` (+ `fieldName` where relevant)
- Copies FHIR reference strings (e.g. `"Patient/patient-123"`) as-is into `*Reference` columns and the `references` table; references are not resolved to generated ids
- Stamps rows with `createdAt` (and `updatedAt` on main rows) set to the time of normalization

It does not deduplicate rows (two identical addresses produce two `addresses` rows), validate resources, or talk to a database.

## Supported FHIR Resources

Entries whose `resourceType` is one of the following are normalized; any other resource type only produces a `bundleEntries` row.

- **Patient**: demographics, identifiers, names, contacts (with their telecoms/address), addresses, telecoms, general practitioners, photos, marital status
- **Practitioner**: demographics, qualifications, identifiers, names, telecoms, addresses, photos, communication languages
- **Organization**: types, identifiers, telecoms, addresses, endpoints
- **Encounter**: class, status, period, participants, subject, identifiers, basedOn, appointments, reasons
- **Condition**: clinical/verification status, code, category, body site, notes
- **Observation**: code, value, components, category, interpretation, notes, performers, related references
- **MedicationRequest**: medication, dosage instructions (first dose/rate), category, reasons, notes, related references
- **Procedure**: performers, reasons, body site, complications, follow-up, notes, used items
- **Immunization**: vaccine, dose, site/route, reasons, subpotent reasons, program eligibility, notes
- **AllergyIntolerance**: reactions, manifestations, categories, notes
- **DiagnosticReport**: result references, category, performers, conclusion codes, presented forms
- **Location**: position, type, aliases, telecoms, address, endpoints
- **Appointment**: participants, reasons, slots, related references
- **CareTeam**: participants, category, reasons, managing organizations, telecoms, notes
- **CarePlan**: activities, category, goals, care teams and other references, notes

Sub-structures not listed (for example `Condition.evidence`, `Encounter.location`, `Immunization.reaction`/`protocolApplied`, `Patient.communication`) are typed but not normalized.

## Usage

```typescript
import { normalizeFhirBundle, IFhirBundle } from '@onivoro/isomorphic-fhir';

const fhirBundle: IFhirBundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
        birthDate: '1985-03-15',
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'observation-456',
        status: 'final',
        code: { coding: [{ code: '8867-4', display: 'Heart rate' }] },
        subject: { reference: 'Patient/patient-123' },
        value: { value: 72, unit: 'beats/min' },
      },
    },
  ],
};

const normalizedData = normalizeFhirBundle(fhirBundle);

console.log(normalizedData.bundles); // one row for the bundle
console.log(normalizedData.patients); // patient demographics
console.log(normalizedData.patientNames); // patient names, linked by patientId
console.log(normalizedData.observations); // valueType 'Quantity', valueNumber 72, valueString 'beats/min'
```

### Choice-type (`[x]`) fields

The input interfaces model FHIR choice-type elements with a single un-suffixed property, and the normalizer only reads that property. Use `value`, `effective`, `onset`, `abatement`, `deceased`, `multipleBirth`, `medication`, `performed`, `occurrence`, `asNeeded` and `scheduled` rather than the wire-format names such as `valueQuantity`, `effectiveDateTime` or `medicationCodeableConcept`. Raw FHIR JSON from a server must be mapped to these names first, or those fields are left empty.

## API

### `normalizeFhirBundle(bundle: IFhirBundle): INormalizedFhirData`

Returns an `INormalizedFhirData` object with one array per table. Every array is always present (empty when there is nothing to put in it).

### Types

- **Input interfaces** (`fhir-resources.interface`): `IFhirBundle`, `IFhirBundleEntry`, the `IFhirResource` union, one interface per supported resource (`IFhirPatient`, `IFhirPractitioner`, `IFhirOrganization`, `IFhirEncounter`, `IFhirCondition`, `IFhirObservation`, `IFhirMedicationRequest`, `IFhirProcedure`, `IFhirImmunization`, `IFhirAllergyIntolerance`, `IFhirDiagnosticReport`, `IFhirLocation`, `IFhirAppointment`, `IFhirCareTeam`, `IFhirCarePlan`), common data types (`IFhirIdentifier`, `IFhirHumanName`, `IFhirContactPoint`, `IFhirAddress`, `IFhirCodeableConcept`, `IFhirCoding`, `IFhirReference`, `IFhirPeriod`, `IFhirQuantity`, `IFhirRange`, `IFhirAge`, `IFhirAttachment`, `IFhirAnnotation`, `IFhirDuration`, `IFhirDateTime`, `IFhirDosage`, `IFhirTiming`, `IFhirTimingRepeat`, `IFhirRatio`, `IFhirDosageDoseAndRate`) and backbone elements (e.g. `IFhirPatientContact`, `IFhirEncounterParticipant`, `IFhirObservationComponent`, `IFhirCarePlanActivityDetail`).
- **Output interfaces** (`fhir-normalized-tables.interface`): `INormalizedFhirData` and one row interface per table, named `I<Table>Table` (e.g. `IPatientTable`, `IObservationComponentTable`, `ICodingTable`, `IReferenceTable`, `IBundleEntryTable`).

```typescript
import { INormalizedFhirData, IPatientTable } from '@onivoro/isomorphic-fhir';

function patientsBornBefore(data: INormalizedFhirData, isoDate: string): IPatientTable[] {
  return data.patients.filter((p) => p.birthDate && p.birthDate < isoDate);
}
```

## Normalized Tables Generated

`INormalizedFhirData` has 39 tables.

### Core Resource Tables

- **bundles**: bundle metadata (`type`, `timestamp`, `total`)
- **bundleEntries**: one row per entry (`fullUrl`, search mode/score, `resourceType`, `resourceId`)
- **patients**, **practitioners**, **organizations**, **encounters**, **conditions**, **observations**, **medicationRequests**, **procedures**, **immunizations**, **allergyIntolerances**, **diagnosticReports**, **locations**, **appointments**, **careTeams**, **carePlans**: one row per resource; coded fields are flattened to the first coding's code/display

### Relationship and Detail Tables

- **patientIdentifiers**, **patientNames**, **patientContacts**
- **practitionerQualifications**
- **organizationTypes** (first coding of each type)
- **encounterParticipants**
- **observationComponents**
- **medicationDosages**
- **procedurePerformers**
- **allergyReactions**, **allergyManifestations**
- **diagnosticReportResults**
- **appointmentParticipants**
- **careTeamParticipants**
- **carePlanActivities**

### Common Data Type Tables

- **addresses**: addresses of any resource (`line` joined with `\n`)
- **telecoms**: contact points
- **codeableConcepts**: one row per CodeableConcept, with `fieldName` (e.g. `category`, `reasonCode`)
- **codings**: codings of each CodeableConcept, linked by `codeableConceptId`
- **notes**: annotations
- **attachments**: photos and presented forms
- **references**: references, keyed by `fieldName` (e.g. `subject`, `basedOn`, `performer`)

Identifiers of resources other than Patient are stored in **references** with `fieldName: 'identifier'` (the identifier's `type` goes to **codeableConcepts** as `identifier.type`). Practitioner names are stored as text in **codeableConcepts** with `fieldName: 'name'`: the name's `text`, or else its prefix, given, family and suffix parts joined with spaces, skipping missing parts. Patient contact names follow the same rule (`text`, or else given and family). The generic tables' `resourceId` is the generated row id of the owning record, not the FHIR id.

## Testing

```bash
npx nx test lib-isomorphic-fhir
```

The project also contains integration specs that call the public HAPI FHIR server; see `INTEGRATION_TESTS.md` in the repository.

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
