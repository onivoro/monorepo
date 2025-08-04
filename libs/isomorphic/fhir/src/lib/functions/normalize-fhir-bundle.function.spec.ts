import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import { IFhirBundle, IFhirPatient, IFhirPractitioner, IFhirEncounter, IFhirObservation } from '../interfaces/fhir-resources.interface';

describe('normalizeFhirBundle', () => {
  const mockFhirBundle: IFhirBundle = {
    resourceType: 'Bundle',
    id: 'bundle-123',
    type: 'searchset',
    timestamp: '2024-01-01T12:00:00Z',
    total: 4,
    entry: [
      {
        fullUrl: 'https://fhir.example.com/Patient/patient-123',
        resource: {
          resourceType: 'Patient',
          id: 'patient-123',
          active: true,
          identifier: [
            {
              use: 'usual',
              system: 'http://hospital.example.com/patients',
              value: 'MRN123456',
            },
          ],
          name: [
            {
              use: 'official',
              family: 'Doe',
              given: ['John', 'Michael'],
              prefix: ['Mr'],
            },
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-123-4567',
              use: 'home',
            },
            {
              system: 'email',
              value: 'john.doe@example.com',
              use: 'home',
            },
          ],
          gender: 'male',
          birthDate: '1985-03-15',
          address: [
            {
              use: 'home',
              type: 'physical',
              line: ['123 Main St', 'Apt 4B'],
              city: 'New York',
              state: 'NY',
              postalCode: '10001',
              country: 'USA',
            },
          ],
          maritalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                code: 'M',
                display: 'Married',
              },
            ],
          },
          contact: [
            {
              relationship: [
                {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                      code: 'C',
                      display: 'Emergency Contact',
                    },
                  ],
                },
              ],
              name: {
                family: 'Doe',
                given: ['Jane'],
              },
              telecom: [
                {
                  system: 'phone',
                  value: '+1-555-987-6543',
                  use: 'mobile',
                },
              ],
              gender: 'female',
            },
          ],
        } as IFhirPatient,
      },
      {
        fullUrl: 'https://fhir.example.com/Practitioner/practitioner-456',
        resource: {
          resourceType: 'Practitioner',
          id: 'practitioner-456',
          active: true,
          identifier: [
            {
              use: 'official',
              system: 'http://hospital.example.com/practitioners',
              value: 'PRAC456',
            },
          ],
          name: [
            {
              use: 'official',
              family: 'Smith',
              given: ['Sarah'],
              prefix: ['Dr'],
            },
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-111-2222',
              use: 'work',
            },
          ],
          gender: 'female',
          qualification: [
            {
              code: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
                    code: 'MD',
                    display: 'Doctor of Medicine',
                  },
                ],
              },
            },
          ],
        } as IFhirPractitioner,
      },
      {
        fullUrl: 'https://fhir.example.com/Encounter/encounter-789',
        resource: {
          resourceType: 'Encounter',
          id: 'encounter-789',
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory',
          },
          type: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '185347001',
                  display: 'Encounter for check up',
                },
              ],
            },
          ],
          subject: {
            reference: 'Patient/patient-123',
            display: 'John Michael Doe',
          },
          participant: [
            {
              type: [
                {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                      code: 'PPRF',
                      display: 'primary performer',
                    },
                  ],
                },
              ],
              individual: {
                reference: 'Practitioner/practitioner-456',
                display: 'Dr Sarah Smith',
              },
            },
          ],
          period: {
            start: '2024-01-01T10:00:00Z',
            end: '2024-01-01T10:30:00Z',
          },
        } as IFhirEncounter,
      },
      {
        fullUrl: 'https://fhir.example.com/Observation/observation-321',
        resource: {
          resourceType: 'Observation',
          id: 'observation-321',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8867-4',
                display: 'Heart rate',
              },
            ],
          },
          subject: {
            reference: 'Patient/patient-123',
          },
          encounter: {
            reference: 'Encounter/encounter-789',
          },
          effective: '2024-01-01T10:15:00Z',
          value: {
            value: 72,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min',
          },
          component: [
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure',
                  },
                ],
              },
              value: {
                value: 120,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8462-4',
                    display: 'Diastolic blood pressure',
                  },
                ],
              },
              value: {
                value: 80,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
          ],
        } as IFhirObservation,
      },
    ],
  };

  it('should normalize a complete FHIR bundle', () => {
    const result = normalizeFhirBundle(mockFhirBundle);

    // Check bundle table
    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0].resourceId).toBe('bundle-123');
    expect(result.bundles[0].type).toBe('searchset');
    expect(result.bundles[0].total).toBe(4);

    // Check bundle entries
    expect(result.bundleEntries).toHaveLength(4);
    expect(result.bundleEntries[0].fullUrl).toBe('https://fhir.example.com/Patient/patient-123');
    expect(result.bundleEntries[0].resourceType).toBe('Patient');
    expect(result.bundleEntries[0].resourceId).toBe('patient-123');

    // Check patient table
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0].resourceId).toBe('patient-123');
    expect(result.patients[0].gender).toBe('male');
    expect(result.patients[0].birthDate).toBe('1985-03-15');
    expect(result.patients[0].active).toBe(true);

    // Check patient identifiers
    expect(result.patientIdentifiers).toHaveLength(1);
    expect(result.patientIdentifiers[0].use).toBe('usual');
    expect(result.patientIdentifiers[0].system).toBe('http://hospital.example.com/patients');
    expect(result.patientIdentifiers[0].value).toBe('MRN123456');

    // Check patient names
    expect(result.patientNames).toHaveLength(1);
    expect(result.patientNames[0].use).toBe('official');
    expect(result.patientNames[0].family).toBe('Doe');
    expect(result.patientNames[0].given).toBe('John Michael');
    expect(result.patientNames[0].prefix).toBe('Mr');

    // Check addresses
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses[0].resourceType).toBe('Patient');
    expect(result.addresses[0].use).toBe('home');
    expect(result.addresses[0].line).toBe('123 Main St\nApt 4B');
    expect(result.addresses[0].city).toBe('New York');
    expect(result.addresses[0].state).toBe('NY');

    // Check telecoms
    expect(result.telecoms).toHaveLength(4); // 2 for patient, 1 for patient contact, 1 for practitioner
    const patientTelecoms = result.telecoms.filter(t => t.resourceType === 'Patient');
    expect(patientTelecoms).toHaveLength(2);
    expect(patientTelecoms[0].system).toBe('phone');
    expect(patientTelecoms[0].value).toBe('+1-555-123-4567');
    expect(patientTelecoms[1].system).toBe('email');
    expect(patientTelecoms[1].value).toBe('john.doe@example.com');

    // Check patient contacts
    expect(result.patientContacts).toHaveLength(1);
    expect(result.patientContacts[0].relationshipCode).toBe('C');
    expect(result.patientContacts[0].relationshipText).toBeUndefined();
    expect(result.patientContacts[0].name).toBe('Jane Doe');
    expect(result.patientContacts[0].gender).toBe('female');

    // Check practitioners
    expect(result.practitioners).toHaveLength(1);
    expect(result.practitioners[0].resourceId).toBe('practitioner-456');
    expect(result.practitioners[0].gender).toBe('female');
    expect(result.practitioners[0].active).toBe(true);

    // Check practitioner qualifications
    expect(result.practitionerQualifications).toHaveLength(1);
    expect(result.practitionerQualifications[0].code).toBe('MD');
    expect(result.practitionerQualifications[0].codeDisplay).toBe('Doctor of Medicine');

    // Check encounters
    expect(result.encounters).toHaveLength(1);
    expect(result.encounters[0].resourceId).toBe('encounter-789');
    expect(result.encounters[0].status).toBe('finished');
    expect(result.encounters[0].class).toBe('AMB');
    expect(result.encounters[0].classDisplay).toBe('ambulatory');
    expect(result.encounters[0].subjectReference).toBe('Patient/patient-123');
    expect(result.encounters[0].periodStart).toBe('2024-01-01T10:00:00Z');
    expect(result.encounters[0].periodEnd).toBe('2024-01-01T10:30:00Z');

    // Check encounter participants
    expect(result.encounterParticipants).toHaveLength(1);
    expect(result.encounterParticipants[0].typeCode).toBe('PPRF');
    expect(result.encounterParticipants[0].typeDisplay).toBe('primary performer');
    expect(result.encounterParticipants[0].individualReference).toBe('Practitioner/practitioner-456');

    // Check observations
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].resourceId).toBe('observation-321');
    expect(result.observations[0].status).toBe('final');
    expect(result.observations[0].code).toBe('8867-4');
    expect(result.observations[0].codeDisplay).toBe('Heart rate');
    expect(result.observations[0].subjectReference).toBe('Patient/patient-123');
    expect(result.observations[0].encounterReference).toBe('Encounter/encounter-789');
    expect(result.observations[0].effectiveDateTime).toBe('2024-01-01T10:15:00Z');
    expect(result.observations[0].valueType).toBe('Quantity');
    expect(result.observations[0].valueNumber).toBe(72);
    expect(result.observations[0].valueString).toBe('beats/min');

    // Check observation components
    expect(result.observationComponents).toHaveLength(2);
    expect(result.observationComponents[0].code).toBe('8480-6');
    expect(result.observationComponents[0].codeDisplay).toBe('Systolic blood pressure');
    expect(result.observationComponents[0].valueNumber).toBe(120);
    expect(result.observationComponents[1].code).toBe('8462-4');
    expect(result.observationComponents[1].codeDisplay).toBe('Diastolic blood pressure');
    expect(result.observationComponents[1].valueNumber).toBe(80);

    // Check codeable concepts
    expect(result.codeableConcepts.length).toBeGreaterThan(0);
    const maritalStatusConcept = result.codeableConcepts.find(cc => 
      cc.resourceType === 'Patient' && cc.fieldName === 'maritalStatus'
    );
    expect(maritalStatusConcept).toBeDefined();

    // Check codings
    expect(result.codings.length).toBeGreaterThan(0);
    const maritalStatusCoding = result.codings.find(c => 
      c.system === 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus' && c.code === 'M'
    );
    expect(maritalStatusCoding).toBeDefined();
    expect(maritalStatusCoding?.display).toBe('Married');

    // Check references
    expect(result.references.length).toBeGreaterThan(0);
    const subjectReference = result.references.find(r => 
      r.resourceType === 'Encounter' && r.fieldName === 'subject'
    );
    expect(subjectReference).toBeDefined();
    expect(subjectReference?.reference).toBe('Patient/patient-123');
    expect(subjectReference?.display).toBe('John Michael Doe');
  });

  it('should handle empty bundle', () => {
    const emptyBundle: IFhirBundle = {
      resourceType: 'Bundle',
      id: 'empty-bundle',
      type: 'searchset',
      total: 0,
      entry: [],
    };

    const result = normalizeFhirBundle(emptyBundle);

    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0].resourceId).toBe('empty-bundle');
    expect(result.bundles[0].total).toBe(0);
    expect(result.bundleEntries).toHaveLength(0);
    expect(result.patients).toHaveLength(0);
    expect(result.practitioners).toHaveLength(0);
    expect(result.encounters).toHaveLength(0);
    expect(result.observations).toHaveLength(0);
  });

  it('should handle bundle without resource IDs', () => {
    const bundleWithoutIds: IFhirBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            name: [
              {
                family: 'Anonymous',
                given: ['Test'],
              },
            ],
            gender: 'unknown',
          } as IFhirPatient,
        },
      ],
    };

    const result = normalizeFhirBundle(bundleWithoutIds);

    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0].resourceId).toBeUndefined();
    expect(result.bundleEntries).toHaveLength(1);
    expect(result.bundleEntries[0].resourceId).toBeUndefined();
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0].resourceId).toBeUndefined();
    expect(result.patients[0].gender).toBe('unknown');
  });

  it('should handle various observation value types', () => {
    const observationBundle: IFhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-string',
            status: 'final',
            code: {
              coding: [{ code: 'test-code', display: 'Test Code' }],
            },
            value: 'string value',
          } as IFhirObservation,
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-boolean',
            status: 'final',
            code: {
              coding: [{ code: 'bool-code', display: 'Boolean Code' }],
            },
            value: true,
          } as IFhirObservation,
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-number',
            status: 'final',
            code: {
              coding: [{ code: 'num-code', display: 'Number Code' }],
            },
            value: 42.5,
          } as IFhirObservation,
        },
      ],
    };

    const result = normalizeFhirBundle(observationBundle);

    expect(result.observations).toHaveLength(3);
    
    const stringObs = result.observations.find(o => o.resourceId === 'obs-string');
    expect(stringObs?.valueType).toBe('string');
    expect(stringObs?.valueString).toBe('string value');

    const boolObs = result.observations.find(o => o.resourceId === 'obs-boolean');
    expect(boolObs?.valueType).toBe('boolean');
    expect(boolObs?.valueBoolean).toBe(true);

    const numberObs = result.observations.find(o => o.resourceId === 'obs-number');
    expect(numberObs?.valueType).toBe('number');
    expect(numberObs?.valueNumber).toBe(42.5);
  });

  it('should generate unique IDs for all normalized records', () => {
    const result = normalizeFhirBundle(mockFhirBundle);

    // Collect all IDs from all tables
    const allIds = [
      ...result.bundles.map(r => r.id),
      ...result.bundleEntries.map(r => r.id),
      ...result.patients.map(r => r.id),
      ...result.patientIdentifiers.map(r => r.id),
      ...result.patientNames.map(r => r.id),
      ...result.patientContacts.map(r => r.id),
      ...result.practitioners.map(r => r.id),
      ...result.practitionerQualifications.map(r => r.id),
      ...result.encounters.map(r => r.id),
      ...result.encounterParticipants.map(r => r.id),
      ...result.observations.map(r => r.id),
      ...result.observationComponents.map(r => r.id),
      ...result.addresses.map(r => r.id),
      ...result.telecoms.map(r => r.id),
      ...result.codeableConcepts.map(r => r.id),
      ...result.codings.map(r => r.id),
      ...result.references.map(r => r.id),
    ];

    // Check that all IDs are unique
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);

    // Check that all IDs are valid UUIDs (36 characters with hyphens)
    allIds.forEach(id => {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  it('should preserve FHIR resource relationships through references', () => {
    const result = normalizeFhirBundle(mockFhirBundle);

    // Check that encounter references patient
    const encounter = result.encounters[0];
    expect(encounter.subjectReference).toBe('Patient/patient-123');

    // Check that observation references both patient and encounter
    const observation = result.observations[0];
    expect(observation.subjectReference).toBe('Patient/patient-123');
    expect(observation.encounterReference).toBe('Encounter/encounter-789');

    // Check that encounter participant references practitioner
    const participant = result.encounterParticipants[0];
    expect(participant.individualReference).toBe('Practitioner/practitioner-456');

    // Verify references are stored in the references table
    const subjectRef = result.references.find(r => 
      r.resourceType === 'Encounter' && 
      r.fieldName === 'subject' && 
      r.reference === 'Patient/patient-123'
    );
    expect(subjectRef).toBeDefined();
    expect(subjectRef?.display).toBe('John Michael Doe');
  });

  it('should handle complex nested structures correctly', () => {
    const result = normalizeFhirBundle(mockFhirBundle);

    // Check that nested contact information is properly normalized
    expect(result.patientContacts).toHaveLength(1);
    const contact = result.patientContacts[0];
    expect(contact.relationshipCode).toBe('C');
    expect(contact.name).toBe('Jane Doe');

    // Check that contact telecoms are separate records
    const contactTelecoms = result.telecoms.filter(t => t.resourceType === 'PatientContact');
    expect(contactTelecoms).toHaveLength(1);
    expect(contactTelecoms[0].system).toBe('phone');
    expect(contactTelecoms[0].value).toBe('+1-555-987-6543');

    // Check that observation components are properly separated
    expect(result.observationComponents).toHaveLength(2);
    const systolicBP = result.observationComponents.find(c => c.code === '8480-6');
    const diastolicBP = result.observationComponents.find(c => c.code === '8462-4');
    
    expect(systolicBP).toBeDefined();
    expect(systolicBP?.valueNumber).toBe(120);
    expect(diastolicBP).toBeDefined();
    expect(diastolicBP?.valueNumber).toBe(80);
  });
});