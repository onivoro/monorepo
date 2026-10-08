import { normalizeFhirBundle } from './normalize-fhir-bundle.function';
import { IFhirBundle } from '../interfaces/fhir-resources.interface';
import { INormalizedFhirData } from '../interfaces/fhir-normalized-tables.interface';

// Pure unit tests for normalizeFhirBundle covering every supported resource
// type and the shared helper tables. No network access.

function normalize(...resources: any[]): INormalizedFhirData {
  return normalizeFhirBundle({
    resourceType: 'Bundle',
    type: 'collection',
    entry: resources.map((resource) => ({ resource })),
  } as IFhirBundle);
}

function refs(
  result: INormalizedFhirData,
  resourceType: string,
  fieldName: string,
) {
  return result.references
    .filter((r) => r.resourceType === resourceType && r.fieldName === fieldName)
    .map((r) => r.reference);
}

function concepts(
  result: INormalizedFhirData,
  resourceType: string,
  fieldName: string,
) {
  return result.codeableConcepts.filter(
    (c) => c.resourceType === resourceType && c.fieldName === fieldName,
  );
}

const coding = (code: string, display?: string, system = 'http://sys') => ({
  coding: [{ system, code, display }],
});
const ref = (reference: string) => ({ reference });
const note = (text: string) => ({
  text,
  authorString: 'nurse',
  time: '2024-01-01',
});

describe('normalizeFhirBundle (resource coverage)', () => {
  describe('bundle and entries', () => {
    it('records bundle metadata, search info, and entries without resources', () => {
      const result = normalizeFhirBundle({
        resourceType: 'Bundle',
        id: 'b1',
        type: 'searchset',
        timestamp: '2024-01-01T00:00:00Z',
        total: 2,
        entry: [
          { fullUrl: 'urn:a', search: { mode: 'match', score: 0.9 } },
          {
            fullUrl: 'urn:b',
            resource: { resourceType: 'Basic', id: 'x' } as any,
          },
        ],
      } as IFhirBundle);

      expect(result.bundles).toEqual([
        expect.objectContaining({
          resourceId: 'b1',
          type: 'searchset',
          timestamp: '2024-01-01T00:00:00Z',
          total: 2,
          createdAt: expect.any(Date),
        }),
      ]);
      expect(result.bundleEntries).toEqual([
        expect.objectContaining({
          bundleId: result.bundles[0].id,
          fullUrl: 'urn:a',
          searchMode: 'match',
          searchScore: 0.9,
        }),
        expect.objectContaining({
          fullUrl: 'urn:b',
          resourceType: 'Basic',
          resourceId: 'x',
        }),
      ]);
      expect(result.bundleEntries[0].resourceType).toBeUndefined();
    });

    it('ignores unsupported resource types beyond the entry record', () => {
      const result = normalize({ resourceType: 'Basic', id: 'x' });
      const { bundles, bundleEntries, ...rest } = result;

      expect(bundles).toHaveLength(1);
      expect(bundleEntries).toHaveLength(1);
      Object.values(rest).forEach((table) => expect(table).toEqual([]));
    });

    it('handles a bundle with no entry array', () => {
      const result = normalizeFhirBundle({
        resourceType: 'Bundle',
        type: 'collection',
      } as IFhirBundle);
      expect(result.bundles).toHaveLength(1);
      expect(result.bundleEntries).toEqual([]);
    });
  });

  describe('Patient', () => {
    const patient = {
      resourceType: 'Patient',
      id: 'p1',
      active: true,
      gender: 'female',
      birthDate: '1990-01-01',
      deceased: '2020-02-02',
      multipleBirth: 2,
      maritalStatus: {
        text: 'Single',
        coding: [{ code: 'S', display: 'Never Married' }],
      },
      managingOrganization: ref('Organization/o1'),
      identifier: [
        {
          use: 'official',
          system: 'urn:mrn',
          value: '123',
          period: { start: '2000', end: '2010' },
          assigner: ref('Organization/o1'),
        },
      ],
      name: [
        {
          use: 'official',
          family: 'Doe',
          given: ['Jane', 'Q'],
          prefix: ['Dr'],
          suffix: ['PhD'],
        },
      ],
      contact: [
        {
          relationship: [{ text: 'Mother', coding: [{ code: 'N' }] }],
          name: { text: 'Mom Doe' },
          gender: 'female',
          organization: ref('Organization/o2'),
          period: { start: '2001' },
          telecom: [{ system: 'phone', value: '555' }],
          address: { city: 'Springfield' },
        },
        { name: { given: ['Pat'], family: 'Smith' } },
        { name: { family: 'Smith' } },
      ],
      generalPractitioner: [ref('Practitioner/gp')],
      photo: [
        {
          contentType: 'image/png',
          url: 'http://photo',
          size: 10,
          title: 'me',
        },
      ],
    };

    it('maps the patient record, preferring maritalStatus.text', () => {
      const result = normalize(patient);

      expect(result.patients[0]).toEqual(
        expect.objectContaining({
          resourceId: 'p1',
          active: true,
          gender: 'female',
          birthDate: '1990-01-01',
          deceased: undefined,
          deceasedDateTime: '2020-02-02',
          maritalStatus: 'Single',
          multipleBirth: undefined,
          multipleBirthInteger: 2,
          managingOrganizationId: 'Organization/o1',
        }),
      );
    });

    it('maps boolean deceased/multipleBirth and falls back to the coding display', () => {
      const result = normalize({
        resourceType: 'Patient',
        deceased: true,
        multipleBirth: false,
        maritalStatus: { coding: [{ code: 'M', display: 'Married' }] },
      });

      expect(result.patients[0]).toEqual(
        expect.objectContaining({
          deceased: true,
          deceasedDateTime: undefined,
          multipleBirth: false,
          multipleBirthInteger: undefined,
          maritalStatus: 'Married',
        }),
      );
    });

    it('normalizes identifiers, names, contacts, references, photos and marital status', () => {
      const result = normalize(patient);
      const patientId = result.patients[0].id;

      expect(result.patientIdentifiers).toEqual([
        expect.objectContaining({
          patientId,
          use: 'official',
          system: 'urn:mrn',
          value: '123',
          periodStart: '2000',
          periodEnd: '2010',
          assignerReference: 'Organization/o1',
        }),
      ]);
      expect(result.patientNames).toEqual([
        expect.objectContaining({
          patientId,
          family: 'Doe',
          given: 'Jane Q',
          prefix: 'Dr',
          suffix: 'PhD',
        }),
      ]);
      expect(result.patientContacts).toEqual([
        expect.objectContaining({
          patientId,
          relationshipCode: 'N',
          relationshipText: 'Mother',
          name: 'Mom Doe',
          gender: 'female',
          organizationReference: 'Organization/o2',
          periodStart: '2001',
        }),
        expect.objectContaining({ name: 'Pat Smith' }),
        expect.objectContaining({ name: 'Smith' }),
      ]);

      const contactId = result.patientContacts[0].id;
      expect(result.telecoms).toEqual([
        expect.objectContaining({
          resourceType: 'PatientContact',
          resourceId: contactId,
          value: '555',
        }),
      ]);
      expect(result.addresses).toEqual([
        expect.objectContaining({
          resourceType: 'PatientContact',
          resourceId: contactId,
          city: 'Springfield',
        }),
      ]);
      expect(refs(result, 'Patient', 'generalPractitioner')).toEqual([
        'Practitioner/gp',
      ]);
      expect(result.attachments).toEqual([
        expect.objectContaining({
          resourceType: 'Patient',
          resourceId: patientId,
          fieldName: 'photo',
          contentType: 'image/png',
          url: 'http://photo',
          size: 10,
          title: 'me',
        }),
      ]);
      expect(concepts(result, 'Patient', 'maritalStatus')).toEqual([
        expect.objectContaining({ text: 'Single' }),
      ]);
      expect(result.codings).toEqual([
        expect.objectContaining({
          codeableConceptId: concepts(result, 'Patient', 'maritalStatus')[0].id,
          code: 'S',
        }),
      ]);
    });

    it('stores patient addresses and telecoms against the patient', () => {
      const result = normalize({
        resourceType: 'Patient',
        address: [
          {
            use: 'home',
            type: 'both',
            text: '1 Main',
            line: ['1 Main St', 'Apt 2'],
            city: 'Town',
            district: 'D',
            state: 'ST',
            postalCode: '00000',
            country: 'US',
            period: { start: 'a', end: 'b' },
          },
        ],
        telecom: [
          {
            system: 'email',
            value: 'a@b.c',
            use: 'work',
            rank: 1,
            period: { start: 's', end: 'e' },
          },
        ],
      });
      const patientId = result.patients[0].id;

      expect(result.addresses).toEqual([
        expect.objectContaining({
          resourceType: 'Patient',
          resourceId: patientId,
          line: '1 Main St\nApt 2',
          city: 'Town',
          district: 'D',
          periodStart: 'a',
          periodEnd: 'b',
        }),
      ]);
      expect(result.telecoms).toEqual([
        expect.objectContaining({
          resourceType: 'Patient',
          resourceId: patientId,
          system: 'email',
          use: 'work',
          rank: 1,
          periodStart: 's',
          periodEnd: 'e',
        }),
      ]);
    });
  });

  describe('Practitioner', () => {
    it('normalizes qualifications, identifiers, names and other details', () => {
      const result = normalize({
        resourceType: 'Practitioner',
        id: 'pr1',
        active: true,
        gender: 'male',
        birthDate: '1970',
        qualification: [
          {
            code: coding('MD', 'Doctor'),
            period: { start: '1995' },
            issuer: ref('Organization/school'),
          },
          { code: { text: 'Text only' } },
        ],
        identifier: [
          {
            system: 'urn:npi',
            value: '999',
            use: 'official',
            type: coding('NPI'),
          },
        ],
        name: [{ text: 'Dr. Who' }],
        telecom: [{ system: 'phone', value: '1' }],
        address: [{ city: 'C' }],
        photo: [{ url: 'u' }],
        communication: [coding('en', 'English')],
      });
      const practitionerId = result.practitioners[0].id;

      expect(result.practitioners[0]).toEqual(
        expect.objectContaining({
          resourceId: 'pr1',
          active: true,
          gender: 'male',
          birthDate: '1970',
        }),
      );
      expect(result.practitionerQualifications).toEqual([
        expect.objectContaining({
          practitionerId,
          code: 'MD',
          codeSystem: 'http://sys',
          codeDisplay: 'Doctor',
          periodStart: '1995',
          issuerReference: 'Organization/school',
        }),
        expect.objectContaining({ code: undefined, codeDisplay: 'Text only' }),
      ]);

      const identifier = result.references.find(
        (r) => r.fieldName === 'identifier',
      );
      expect(identifier).toEqual(
        expect.objectContaining({
          resourceType: 'Practitioner',
          resourceId: practitionerId,
          reference: '999',
          type: 'official',
          display: 'urn:npi|999',
        }),
      );
      expect(JSON.parse(identifier!.identifier!)).toEqual({
        system: 'urn:npi',
        value: '999',
      });
      expect(concepts(result, 'Practitioner', 'identifier.type')).toHaveLength(
        1,
      );

      expect(
        concepts(result, 'Practitioner', 'name').map((c) => c.text),
      ).toEqual(['Dr. Who']);
      expect(concepts(result, 'Practitioner', 'communication')).toHaveLength(1);
      expect(result.telecoms).toHaveLength(1);
      expect(result.addresses).toHaveLength(1);
      expect(result.attachments).toEqual([
        expect.objectContaining({ fieldName: 'photo', url: 'u' }),
      ]);
    });

    it('builds a name from its parts when there is no text', () => {
      const result = normalize({
        resourceType: 'Practitioner',
        name: [
          {
            prefix: ['Dr'],
            given: ['Ann', 'B'],
            family: 'Lee',
            suffix: ['MD'],
          },
        ],
      });

      expect(concepts(result, 'Practitioner', 'name')[0].text).toBe(
        'Dr Ann B Lee MD',
      );
    });

    it('omits missing name parts', () => {
      const result = normalize({
        resourceType: 'Practitioner',
        name: [{ given: ['Ann'], family: 'Lee' }],
      });
      expect(concepts(result, 'Practitioner', 'name')[0].text).toBe('Ann Lee');
    });
  });

  describe('Organization', () => {
    it('normalizes types (skipping those without coding), identifiers, telecoms, addresses and endpoints', () => {
      const result = normalize({
        resourceType: 'Organization',
        id: 'o1',
        active: false,
        name: 'Acme',
        partOf: ref('Organization/parent'),
        type: [
          { coding: [{ system: 's', code: 'prov' }], text: 'Provider' },
          { coding: [{ system: 's', code: 'dept', display: 'Department' }] },
          { text: 'No coding' },
        ],
        identifier: [{ system: 'urn:tax', value: 'T1' }],
        telecom: [{ value: 'x' }],
        address: [{ city: 'Y' }],
        endpoint: [ref('Endpoint/e1')],
      });
      const organizationId = result.organizations[0].id;

      expect(result.organizations[0]).toEqual(
        expect.objectContaining({
          resourceId: 'o1',
          active: false,
          name: 'Acme',
          partOfReference: 'Organization/parent',
        }),
      );
      expect(result.organizationTypes).toEqual([
        expect.objectContaining({
          organizationId,
          code: 'prov',
          display: 'Provider',
        }),
        expect.objectContaining({
          organizationId,
          code: 'dept',
          display: 'Department',
        }),
      ]);
      expect(refs(result, 'Organization', 'identifier')).toEqual(['T1']);
      expect(refs(result, 'Organization', 'endpoint')).toEqual(['Endpoint/e1']);
      expect(result.telecoms).toHaveLength(1);
      expect(result.addresses).toHaveLength(1);
    });
  });

  describe('Encounter', () => {
    it('normalizes the encounter, participants and references', () => {
      const result = normalize({
        resourceType: 'Encounter',
        id: 'e1',
        status: 'finished',
        class: { system: 'cls', code: 'AMB', display: 'ambulatory' },
        serviceType: { text: 'General' },
        priority: coding('R'),
        subject: {
          reference: 'Patient/p1',
          display: 'Pat',
          type: 'Patient',
          identifier: { value: 'i' },
        },
        episodeOfCare: [ref('EpisodeOfCare/eoc')],
        serviceProvider: ref('Organization/o1'),
        partOf: ref('Encounter/parent'),
        period: { start: 's', end: 'e' },
        length: { value: 30, unit: 'min' },
        participant: [
          {
            type: [{ text: 'Attender' }],
            individual: ref('Practitioner/pr1'),
            period: { start: 'ps', end: 'pe' },
          },
        ],
        identifier: [{ value: 'enc-1' }],
        basedOn: [ref('ServiceRequest/sr')],
        appointment: [ref('Appointment/a1')],
        reasonCode: [coding('pain')],
        reasonReference: [ref('Condition/c1')],
      });
      const encounterId = result.encounters[0].id;

      expect(result.encounters[0]).toEqual(
        expect.objectContaining({
          resourceId: 'e1',
          status: 'finished',
          class: 'AMB',
          classSystem: 'cls',
          classDisplay: 'ambulatory',
          serviceType: 'General',
          priority: 'R',
          subjectReference: 'Patient/p1',
          episodeOfCareReference: 'EpisodeOfCare/eoc',
          serviceProviderReference: 'Organization/o1',
          partOfReference: 'Encounter/parent',
          periodStart: 's',
          periodEnd: 'e',
          lengthValue: 30,
          lengthUnit: 'min',
        }),
      );
      expect(result.encounterParticipants).toEqual([
        expect.objectContaining({
          encounterId,
          typeCode: undefined,
          typeDisplay: 'Attender',
          individualReference: 'Practitioner/pr1',
          periodStart: 'ps',
          periodEnd: 'pe',
        }),
      ]);

      const subject = result.references.find((r) => r.fieldName === 'subject');
      expect(subject).toEqual(
        expect.objectContaining({
          reference: 'Patient/p1',
          display: 'Pat',
          type: 'Patient',
          identifier: '{"value":"i"}',
        }),
      );
      expect(refs(result, 'Encounter', 'basedOn')).toEqual([
        'ServiceRequest/sr',
      ]);
      expect(refs(result, 'Encounter', 'appointment')).toEqual([
        'Appointment/a1',
      ]);
      expect(refs(result, 'Encounter', 'reasonReference')).toEqual([
        'Condition/c1',
      ]);
      expect(refs(result, 'Encounter', 'identifier')).toEqual(['enc-1']);
      expect(concepts(result, 'Encounter', 'reasonCode')).toHaveLength(1);
    });

    it('defaults a missing class code to an empty string', () => {
      const result = normalize({
        resourceType: 'Encounter',
        status: 'planned',
        class: {},
      });
      expect(result.encounters[0].class).toBe('');
      expect(result.references).toEqual([]);
    });
  });

  describe('Condition', () => {
    it('normalizes codes, timing and child records', () => {
      const result = normalize({
        resourceType: 'Condition',
        id: 'c1',
        clinicalStatus: coding('active'),
        verificationStatus: coding('confirmed'),
        severity: coding('severe'),
        code: {
          text: 'Headache',
          coding: [{ system: 'snomed', code: '25064002' }],
        },
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        onset: '2024-01-01',
        abatement: '2024-02-01',
        recordedDate: '2024-01-02',
        recorder: ref('Practitioner/r'),
        asserter: ref('Practitioner/a'),
        identifier: [{ value: 'cid' }],
        category: [coding('problem')],
        bodySite: [coding('head')],
        note: [{ text: 'n', authorReference: ref('Practitioner/r') }],
      });

      expect(result.conditions[0]).toEqual(
        expect.objectContaining({
          resourceId: 'c1',
          clinicalStatus: 'active',
          verificationStatus: 'confirmed',
          severity: 'severe',
          code: '25064002',
          codeSystem: 'snomed',
          codeDisplay: 'Headache',
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          onsetDateTime: '2024-01-01',
          abatementDateTime: '2024-02-01',
          recordedDate: '2024-01-02',
          recorderReference: 'Practitioner/r',
          asserterReference: 'Practitioner/a',
        }),
      );
      expect(concepts(result, 'Condition', 'category')).toHaveLength(1);
      expect(concepts(result, 'Condition', 'bodySite')).toHaveLength(1);
      expect(refs(result, 'Condition', 'identifier')).toEqual(['cid']);
      expect(result.notes).toEqual([
        expect.objectContaining({
          resourceType: 'Condition',
          resourceId: result.conditions[0].id,
          text: 'n',
          authorReference: 'Practitioner/r',
        }),
      ]);
    });

    it('ignores non-string onset/abatement and defaults the subject reference', () => {
      const result = normalize({
        resourceType: 'Condition',
        subject: {},
        onset: { start: 'x' },
        abatement: true,
      });

      expect(result.conditions[0]).toEqual(
        expect.objectContaining({
          subjectReference: '',
          onsetDateTime: undefined,
          abatementDateTime: undefined,
        }),
      );
    });
  });

  describe('Observation', () => {
    const base = {
      resourceType: 'Observation',
      status: 'final',
      code: coding('8867-4', 'Heart rate'),
    };

    it('maps a Quantity value and an effective period', () => {
      const result = normalize({
        ...base,
        id: 'o1',
        value: { value: 72, unit: 'bpm' },
        effective: { start: 's', end: 'e' },
        issued: 'i',
        dataAbsentReason: coding('unknown'),
        bodySite: { text: 'arm' },
        method: coding('m', 'Manual'),
        specimen: ref('Specimen/s'),
        device: ref('Device/d'),
        subject: ref('Patient/p1'),
      });

      expect(result.observations[0]).toEqual(
        expect.objectContaining({
          code: '8867-4',
          codeDisplay: 'Heart rate',
          valueType: 'Quantity',
          valueNumber: 72,
          valueString: 'bpm',
          effectiveDateTime: undefined,
          effectivePeriodStart: 's',
          effectivePeriodEnd: 'e',
          issued: 'i',
          dataAbsentReason: 'unknown',
          bodySite: 'arm',
          method: 'Manual',
          specimenReference: 'Specimen/s',
          deviceReference: 'Device/d',
          subjectReference: 'Patient/p1',
        }),
      );
    });

    it('maps an effective dateTime and leaves valueType unset for unrecognized values', () => {
      const result = normalize({
        ...base,
        effective: '2024-01-01',
        value: { code: 'x' },
      });

      expect(result.observations[0].effectiveDateTime).toBe('2024-01-01');
      expect(result.observations[0].valueType).toBeUndefined();
    });

    it('defaults a missing code to an empty string and uses code.text for display', () => {
      const result = normalize({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Free text' },
      });

      expect(result.observations[0]).toEqual(
        expect.objectContaining({ code: '', codeDisplay: 'Free text' }),
      );
    });

    it('normalizes components of every value type', () => {
      const result = normalize({
        ...base,
        component: [
          { code: coding('a'), value: 'str' },
          { code: coding('b'), value: 5 },
          { code: coding('c'), value: false },
          { code: coding('d'), value: true },
          { code: coding('e'), value: { value: 9, unit: 'u' } },
          { code: { text: 'f' }, dataAbsentReason: coding('masked') },
          { code: coding('g'), value: { code: 'unrecognized' } },
        ],
      });
      const observationId = result.observations[0].id;
      const byCode = (code: string) =>
        result.observationComponents.find((c) => c.code === code);

      expect(result.observationComponents).toHaveLength(7);
      expect(
        result.observationComponents.every(
          (c) => c.observationId === observationId,
        ),
      ).toBe(true);
      expect(byCode('a')).toEqual(
        expect.objectContaining({ valueType: 'string', valueString: 'str' }),
      );
      expect(byCode('b')).toEqual(
        expect.objectContaining({ valueType: 'number', valueNumber: 5 }),
      );
      expect(byCode('c')?.valueType).toBeUndefined();
      expect(byCode('d')).toEqual(
        expect.objectContaining({ valueType: 'boolean', valueBoolean: true }),
      );
      expect(byCode('e')).toEqual(
        expect.objectContaining({ valueType: 'Quantity', valueNumber: 9 }),
      );
      expect(byCode('')).toEqual(
        expect.objectContaining({
          codeDisplay: 'f',
          dataAbsentReason: 'masked',
        }),
      );
      expect(byCode('g')?.valueType).toBeUndefined();
    });

    it('normalizes related references, concepts and notes', () => {
      const result = normalize({
        ...base,
        identifier: [{ value: 'oid' }],
        basedOn: [ref('ServiceRequest/1')],
        partOf: [ref('Procedure/1')],
        category: [coding('vital-signs')],
        interpretation: [coding('H')],
        note: [note('obs note')],
        performer: [ref('Practitioner/1')],
        hasMember: [ref('Observation/2')],
        derivedFrom: [ref('Observation/3')],
      });

      expect(refs(result, 'Observation', 'identifier')).toEqual(['oid']);
      expect(refs(result, 'Observation', 'basedOn')).toEqual([
        'ServiceRequest/1',
      ]);
      expect(refs(result, 'Observation', 'partOf')).toEqual(['Procedure/1']);
      expect(refs(result, 'Observation', 'performer')).toEqual([
        'Practitioner/1',
      ]);
      expect(refs(result, 'Observation', 'hasMember')).toEqual([
        'Observation/2',
      ]);
      expect(refs(result, 'Observation', 'derivedFrom')).toEqual([
        'Observation/3',
      ]);
      expect(concepts(result, 'Observation', 'category')).toHaveLength(1);
      expect(concepts(result, 'Observation', 'interpretation')).toHaveLength(1);
      expect(result.notes).toEqual([
        expect.objectContaining({
          text: 'obs note',
          authorString: 'nurse',
          time: '2024-01-01',
        }),
      ]);
    });
  });

  describe('MedicationRequest', () => {
    it('normalizes a request with a medication concept and dosage instructions', () => {
      const result = normalize({
        resourceType: 'MedicationRequest',
        id: 'm1',
        status: 'active',
        statusReason: coding('sr'),
        intent: 'order',
        priority: 'routine',
        doNotPerform: false,
        medication: { coding: [{ code: 'rx', display: 'Aspirin' }] },
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        authoredOn: '2024',
        requester: ref('Practitioner/req'),
        performer: ref('Practitioner/perf'),
        performerType: coding('pt'),
        recorder: ref('Practitioner/rec'),
        groupIdentifier: { value: 'g1' },
        courseOfTherapyType: coding('acute'),
        priorPrescription: ref('MedicationRequest/old'),
        dosageInstruction: [
          {
            sequence: 1,
            text: 'Take one',
            patientInstruction: 'With food',
            asNeeded: true,
            site: { text: 'mouth' },
            route: coding('po', 'Oral'),
            method: coding('swallow', 'Swallow'),
            doseAndRate: [
              {
                dose: { value: 81, unit: 'mg', code: 'mg' },
                rate: { value: 1, unit: '/d' },
              },
            ],
          },
          {
            asNeeded: coding('pain'),
            doseAndRate: [{ dose: { low: { value: 1 } } }],
          },
          { text: 'no dose' },
        ],
        identifier: [{ value: 'mid' }],
        category: [coding('outpatient')],
        reasonCode: [coding('fever')],
        reasonReference: [ref('Condition/1')],
        supportingInformation: [ref('Observation/1')],
        basedOn: [ref('CarePlan/1')],
        insurance: [ref('Coverage/1')],
        note: [note('med note')],
        detectedIssue: [ref('DetectedIssue/1')],
        eventHistory: [ref('Provenance/1')],
      });
      const medicationRequestId = result.medicationRequests[0].id;

      expect(result.medicationRequests[0]).toEqual(
        expect.objectContaining({
          resourceId: 'm1',
          status: 'active',
          statusReason: 'sr',
          intent: 'order',
          priority: 'routine',
          doNotPerform: false,
          medicationCodeableConcept: 'Aspirin',
          medicationReference: undefined,
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          authoredOn: '2024',
          requesterReference: 'Practitioner/req',
          performerReference: 'Practitioner/perf',
          performerType: 'pt',
          recorderReference: 'Practitioner/rec',
          groupIdentifierValue: 'g1',
          courseOfTherapyType: 'acute',
          priorPrescriptionReference: 'MedicationRequest/old',
        }),
      );
      expect(result.medicationDosages).toEqual([
        expect.objectContaining({
          medicationRequestId,
          sequence: 1,
          text: 'Take one',
          patientInstruction: 'With food',
          asNeeded: true,
          asNeededCode: undefined,
          site: 'mouth',
          route: 'Oral',
          method: 'Swallow',
          doseValue: 81,
          doseUnit: 'mg',
          doseCode: 'mg',
          rateValue: 1,
          rateUnit: '/d',
        }),
        expect.objectContaining({ asNeeded: undefined, asNeededCode: 'pain' }),
        expect.objectContaining({ text: 'no dose' }),
      ]);
      // a non-Quantity dose and an absent doseAndRate leave dose/rate unset
      expect(result.medicationDosages[1]).not.toHaveProperty('doseValue');
      expect(result.medicationDosages[2]).not.toHaveProperty('doseValue');
      expect(result.medicationDosages[2]).not.toHaveProperty('rateValue');

      for (const field of [
        'reasonReference',
        'supportingInformation',
        'basedOn',
        'insurance',
        'detectedIssue',
        'eventHistory',
      ]) {
        expect(refs(result, 'MedicationRequest', field)).toHaveLength(1);
      }
      expect(refs(result, 'MedicationRequest', 'identifier')).toEqual(['mid']);
      expect(concepts(result, 'MedicationRequest', 'category')).toHaveLength(1);
      expect(concepts(result, 'MedicationRequest', 'reasonCode')).toHaveLength(
        1,
      );
      expect(result.notes).toHaveLength(1);
    });

    it('maps a medication reference and defaults the subject reference', () => {
      const result = normalize({
        resourceType: 'MedicationRequest',
        status: 'draft',
        intent: 'plan',
        medication: ref('Medication/med1'),
        subject: {},
      });

      expect(result.medicationRequests[0]).toEqual(
        expect.objectContaining({
          medicationCodeableConcept: undefined,
          medicationReference: 'Medication/med1',
          subjectReference: '',
        }),
      );
    });

    it('uses medication text when the concept has no display', () => {
      const result = normalize({
        resourceType: 'MedicationRequest',
        medication: { coding: [], text: 'Generic' },
        subject: ref('Patient/p'),
      });

      expect(result.medicationRequests[0].medicationCodeableConcept).toBe(
        'Generic',
      );
    });
  });

  describe('Procedure', () => {
    it('normalizes the procedure, performers and related records', () => {
      const result = normalize({
        resourceType: 'Procedure',
        id: 'pr1',
        status: 'completed',
        statusReason: coding('sr'),
        category: coding('surgery'),
        code: coding('appendectomy', 'Appendectomy'),
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        performed: { start: 's', end: 'e' },
        recorder: ref('Practitioner/rec'),
        asserter: ref('Practitioner/as'),
        location: ref('Location/l1'),
        outcome: coding('success'),
        performer: [
          {
            function: coding('surgeon'),
            actor: ref('Practitioner/s'),
            onBehalfOf: ref('Organization/o'),
          },
          { actor: {} },
        ],
        identifier: [{ value: 'pid' }],
        basedOn: [ref('a')],
        partOf: [ref('b')],
        reasonCode: [coding('rc')],
        reasonReference: [ref('c')],
        bodySite: [coding('abdomen')],
        report: [ref('d')],
        complication: [coding('none')],
        complicationDetail: [ref('e')],
        followUp: [coding('fu')],
        note: [note('proc note')],
        usedReference: [ref('f')],
        usedCode: [coding('scalpel')],
      });
      const procedureId = result.procedures[0].id;

      expect(result.procedures[0]).toEqual(
        expect.objectContaining({
          resourceId: 'pr1',
          status: 'completed',
          statusReason: 'sr',
          category: 'surgery',
          code: 'appendectomy',
          codeDisplay: 'Appendectomy',
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          performedDateTime: undefined,
          performedPeriodStart: 's',
          performedPeriodEnd: 'e',
          recorderReference: 'Practitioner/rec',
          asserterReference: 'Practitioner/as',
          locationReference: 'Location/l1',
          outcome: 'success',
        }),
      );
      expect(result.procedurePerformers).toEqual([
        expect.objectContaining({
          procedureId,
          function: 'surgeon',
          actorReference: 'Practitioner/s',
          onBehalfOfReference: 'Organization/o',
        }),
        expect.objectContaining({ actorReference: '' }),
      ]);
      for (const field of [
        'basedOn',
        'partOf',
        'reasonReference',
        'report',
        'complicationDetail',
        'usedReference',
      ]) {
        expect(refs(result, 'Procedure', field)).toHaveLength(1);
      }
      for (const field of [
        'reasonCode',
        'bodySite',
        'complication',
        'followUp',
        'usedCode',
      ]) {
        expect(concepts(result, 'Procedure', field)).toHaveLength(1);
      }
      expect(result.notes).toHaveLength(1);
    });

    it('maps a performed dateTime', () => {
      const result = normalize({
        resourceType: 'Procedure',
        status: 'completed',
        subject: {},
        performed: '2024-05-05',
      });

      expect(result.procedures[0]).toEqual(
        expect.objectContaining({
          subjectReference: '',
          performedDateTime: '2024-05-05',
        }),
      );
    });
  });

  describe('Immunization', () => {
    it('normalizes the immunization and its related records', () => {
      const result = normalize({
        resourceType: 'Immunization',
        id: 'i1',
        status: 'completed',
        statusReason: coding('sr'),
        vaccineCode: coding('207', 'COVID'),
        patient: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        occurrence: '2021-01-01',
        recorded: '2021-01-02',
        primarySource: true,
        reportOrigin: coding('record'),
        location: ref('Location/l'),
        manufacturer: ref('Organization/m'),
        lotNumber: 'LOT',
        expirationDate: '2022',
        site: { text: 'left arm' },
        route: coding('IM', 'Intramuscular'),
        doseQuantity: { value: 0.5, unit: 'mL' },
        isSubpotent: false,
        fundingSource: coding('public'),
        identifier: [{ value: 'iid' }],
        reasonCode: [coding('r')],
        reasonReference: [ref('Condition/c')],
        subpotentReason: [coding('sp')],
        programEligibility: [coding('pe')],
        note: [note('imm note')],
      });

      expect(result.immunizations[0]).toEqual(
        expect.objectContaining({
          resourceId: 'i1',
          status: 'completed',
          statusReason: 'sr',
          vaccineCode: '207',
          vaccineCodeDisplay: 'COVID',
          patientReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          occurrenceDateTime: '2021-01-01',
          recorded: '2021-01-02',
          primarySource: true,
          reportOrigin: 'record',
          locationReference: 'Location/l',
          manufacturerReference: 'Organization/m',
          lotNumber: 'LOT',
          expirationDate: '2022',
          site: 'left arm',
          route: 'Intramuscular',
          doseQuantityValue: 0.5,
          doseQuantityUnit: 'mL',
          isSubpotent: false,
          fundingSource: 'public',
        }),
      );
      expect(refs(result, 'Immunization', 'identifier')).toEqual(['iid']);
      expect(refs(result, 'Immunization', 'reasonReference')).toEqual([
        'Condition/c',
      ]);
      for (const field of [
        'reasonCode',
        'subpotentReason',
        'programEligibility',
      ]) {
        expect(concepts(result, 'Immunization', field)).toHaveLength(1);
      }
      expect(result.notes).toHaveLength(1);
    });

    it('defaults codes and references when missing', () => {
      const result = normalize({
        resourceType: 'Immunization',
        status: 'not-done',
        vaccineCode: { text: 'Flu' },
        patient: {},
        occurrence: { string: 'not a dateTime' },
      });

      expect(result.immunizations[0]).toEqual(
        expect.objectContaining({
          vaccineCode: '',
          vaccineCodeDisplay: 'Flu',
          patientReference: '',
          occurrenceDateTime: undefined,
        }),
      );
    });
  });

  describe('AllergyIntolerance', () => {
    it('normalizes reactions, manifestations, notes and categories', () => {
      const result = normalize({
        resourceType: 'AllergyIntolerance',
        id: 'a1',
        clinicalStatus: coding('active'),
        verificationStatus: coding('confirmed'),
        type: 'allergy',
        criticality: 'high',
        code: { text: 'Peanut' },
        patient: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        onset: '2010',
        recordedDate: '2011',
        recorder: ref('Practitioner/r'),
        asserter: ref('Patient/p1'),
        lastOccurrence: '2020',
        reaction: [
          {
            substance: { text: 'Peanut protein' },
            description: 'Hives',
            onset: '2020',
            severity: 'moderate',
            exposureRoute: coding('oral', 'Oral'),
            manifestation: [coding('hives', 'Hives'), { text: 'Itching' }],
            note: [note('reaction note')],
          },
          { substance: coding('x', 'X') },
        ],
        identifier: [{ value: 'aid' }],
        category: ['food', 'medication'],
        note: [note('allergy note')],
      });
      const allergyId = result.allergyIntolerances[0].id;
      const reactionId = result.allergyReactions[0].id;

      expect(result.allergyIntolerances[0]).toEqual(
        expect.objectContaining({
          resourceId: 'a1',
          clinicalStatus: 'active',
          verificationStatus: 'confirmed',
          type: 'allergy',
          criticality: 'high',
          codeDisplay: 'Peanut',
          patientReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          onsetDateTime: '2010',
          recordedDate: '2011',
          recorderReference: 'Practitioner/r',
          asserterReference: 'Patient/p1',
          lastOccurrence: '2020',
        }),
      );
      expect(result.allergyReactions).toEqual([
        expect.objectContaining({
          allergyIntoleranceId: allergyId,
          substance: 'Peanut protein',
          description: 'Hives',
          onset: '2020',
          severity: 'moderate',
          exposureRoute: 'Oral',
        }),
        expect.objectContaining({ substance: 'X' }),
      ]);
      expect(result.allergyManifestations).toEqual([
        expect.objectContaining({
          allergyReactionId: reactionId,
          code: 'hives',
          codeDisplay: 'Hives',
        }),
        expect.objectContaining({
          allergyReactionId: reactionId,
          code: undefined,
          codeDisplay: 'Itching',
        }),
      ]);
      expect(result.notes.map((n) => [n.resourceType, n.text])).toEqual([
        ['AllergyReaction', 'reaction note'],
        ['AllergyIntolerance', 'allergy note'],
      ]);
      expect(
        concepts(result, 'AllergyIntolerance', 'category').map((c) => c.text),
      ).toEqual(['food', 'medication']);
      expect(refs(result, 'AllergyIntolerance', 'identifier')).toEqual(['aid']);
    });

    it('defaults the patient reference and ignores non-string onset', () => {
      const result = normalize({
        resourceType: 'AllergyIntolerance',
        patient: {},
        onset: { start: 'x' },
      });

      expect(result.allergyIntolerances[0]).toEqual(
        expect.objectContaining({
          patientReference: '',
          onsetDateTime: undefined,
        }),
      );
    });
  });

  describe('DiagnosticReport', () => {
    it('normalizes the report, results and related records', () => {
      const result = normalize({
        resourceType: 'DiagnosticReport',
        id: 'd1',
        status: 'final',
        code: coding('CBC', 'Complete blood count'),
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        effective: { start: 's', end: 'e' },
        issued: 'i',
        conclusion: 'Normal',
        result: [ref('Observation/1'), {}],
        identifier: [{ value: 'did' }],
        basedOn: [ref('a')],
        category: [coding('LAB')],
        performer: [ref('b')],
        resultsInterpreter: [ref('c')],
        specimen: [ref('d')],
        imagingStudy: [ref('e')],
        conclusionCode: [coding('normal')],
        presentedForm: [
          {
            contentType: 'application/pdf',
            data: 'AAAA',
            hash: 'h',
            language: 'en',
            creation: 'c',
          },
        ],
      });
      const diagnosticReportId = result.diagnosticReports[0].id;

      expect(result.diagnosticReports[0]).toEqual(
        expect.objectContaining({
          resourceId: 'd1',
          status: 'final',
          code: 'CBC',
          codeDisplay: 'Complete blood count',
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          effectiveDateTime: undefined,
          effectivePeriodStart: 's',
          effectivePeriodEnd: 'e',
          issued: 'i',
          conclusion: 'Normal',
        }),
      );
      expect(result.diagnosticReportResults).toEqual([
        expect.objectContaining({
          diagnosticReportId,
          resultReference: 'Observation/1',
        }),
        expect.objectContaining({ diagnosticReportId, resultReference: '' }),
      ]);
      for (const field of [
        'basedOn',
        'performer',
        'resultsInterpreter',
        'specimen',
        'imagingStudy',
      ]) {
        expect(refs(result, 'DiagnosticReport', field)).toHaveLength(1);
      }
      expect(concepts(result, 'DiagnosticReport', 'category')).toHaveLength(1);
      expect(
        concepts(result, 'DiagnosticReport', 'conclusionCode'),
      ).toHaveLength(1);
      expect(result.attachments).toEqual([
        expect.objectContaining({
          fieldName: 'presentedForm',
          contentType: 'application/pdf',
          data: 'AAAA',
          hash: 'h',
          language: 'en',
          creation: 'c',
        }),
      ]);
    });

    it('maps an effective dateTime and a text-only code', () => {
      const result = normalize({
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: { text: 'X-ray' },
        effective: '2024',
      });

      expect(result.diagnosticReports[0]).toEqual(
        expect.objectContaining({
          code: '',
          codeDisplay: 'X-ray',
          effectiveDateTime: '2024',
        }),
      );
    });
  });

  describe('Location', () => {
    it('normalizes the location, aliases, types, telecom, address and endpoints', () => {
      const result = normalize({
        resourceType: 'Location',
        id: 'l1',
        status: 'active',
        operationalStatus: { code: 'O' },
        name: 'Ward 1',
        description: 'First ward',
        mode: 'instance',
        physicalType: coding('wa', 'Ward'),
        position: { latitude: 1, longitude: 2, altitude: 3 },
        managingOrganization: ref('Organization/o'),
        partOf: ref('Location/parent'),
        availabilityExceptions: 'Holidays',
        identifier: [{ value: 'lid' }],
        alias: ['W1', 'First'],
        type: [coding('HOSP')],
        telecom: [{ value: 'ext 1' }],
        address: { city: 'Town' },
        endpoint: [ref('Endpoint/e')],
      });
      const locationId = result.locations[0].id;

      expect(result.locations[0]).toEqual(
        expect.objectContaining({
          resourceId: 'l1',
          status: 'active',
          operationalStatus: 'O',
          name: 'Ward 1',
          description: 'First ward',
          mode: 'instance',
          physicalType: 'Ward',
          latitude: 1,
          longitude: 2,
          altitude: 3,
          managingOrganizationReference: 'Organization/o',
          partOfReference: 'Location/parent',
          availabilityExceptions: 'Holidays',
        }),
      );
      expect(concepts(result, 'Location', 'alias[0]')[0].text).toBe('W1');
      expect(concepts(result, 'Location', 'alias[1]')[0].text).toBe('First');
      expect(concepts(result, 'Location', 'type')).toHaveLength(1);
      expect(result.telecoms).toEqual([
        expect.objectContaining({ resourceId: locationId }),
      ]);
      expect(result.addresses).toEqual([
        expect.objectContaining({ resourceId: locationId, city: 'Town' }),
      ]);
      expect(refs(result, 'Location', 'endpoint')).toEqual(['Endpoint/e']);
      expect(refs(result, 'Location', 'identifier')).toEqual(['lid']);
    });
  });

  describe('Appointment', () => {
    it('normalizes the appointment, participants and references', () => {
      const result = normalize({
        resourceType: 'Appointment',
        id: 'ap1',
        status: 'booked',
        cancelationReason: coding('pat'),
        serviceCategory: [coding('gp', 'General Practice')],
        serviceType: [{ text: 'Checkup' }],
        specialty: [coding('394814009', 'General practice')],
        appointmentType: { text: 'ROUTINE' },
        priority: 5,
        description: 'Annual',
        start: 's',
        end: 'e',
        minutesDuration: 15,
        created: 'c',
        comment: 'bring card',
        patientInstruction: 'fast',
        participant: [
          {
            type: [coding('ATND')],
            actor: ref('Practitioner/p'),
            required: 'required',
            status: 'accepted',
            period: { start: 'ps', end: 'pe' },
          },
        ],
        identifier: [{ value: 'apid' }],
        reasonCode: [coding('checkup')],
        reasonReference: [ref('a')],
        supportingInformation: [ref('b')],
        slot: [ref('Slot/1')],
        basedOn: [ref('c')],
      });
      const appointmentId = result.appointments[0].id;

      expect(result.appointments[0]).toEqual(
        expect.objectContaining({
          resourceId: 'ap1',
          status: 'booked',
          cancelationReason: 'pat',
          serviceCategory: 'General Practice',
          serviceType: 'Checkup',
          specialty: 'General practice',
          appointmentType: 'ROUTINE',
          priority: 5,
          description: 'Annual',
          start: 's',
          end: 'e',
          minutesDuration: 15,
          created: 'c',
          comment: 'bring card',
          patientInstruction: 'fast',
        }),
      );
      expect(result.appointmentParticipants).toEqual([
        expect.objectContaining({
          appointmentId,
          type: 'ATND',
          actorReference: 'Practitioner/p',
          required: 'required',
          status: 'accepted',
          periodStart: 'ps',
          periodEnd: 'pe',
        }),
      ]);
      for (const field of [
        'reasonReference',
        'supportingInformation',
        'slot',
        'basedOn',
        'identifier',
      ]) {
        expect(refs(result, 'Appointment', field)).toHaveLength(1);
      }
      expect(concepts(result, 'Appointment', 'reasonCode')).toHaveLength(1);
    });
  });

  describe('CareTeam', () => {
    it('normalizes the care team, participants and related records', () => {
      const result = normalize({
        resourceType: 'CareTeam',
        id: 'ct1',
        status: 'active',
        name: 'Team A',
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        period: { start: 's', end: 'e' },
        participant: [
          {
            role: [{ text: 'Nurse' }],
            member: ref('Practitioner/n'),
            onBehalfOf: ref('Organization/o'),
            period: { start: 'ps', end: 'pe' },
          },
        ],
        identifier: [{ value: 'ctid' }],
        category: [coding('LA')],
        reasonCode: [coding('rc')],
        reasonReference: [ref('Condition/c')],
        managingOrganization: [ref('Organization/m')],
        telecom: [{ value: 't' }],
        note: [note('team note')],
      });
      const careTeamId = result.careTeams[0].id;

      expect(result.careTeams[0]).toEqual(
        expect.objectContaining({
          resourceId: 'ct1',
          status: 'active',
          name: 'Team A',
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          periodStart: 's',
          periodEnd: 'e',
        }),
      );
      expect(result.careTeamParticipants).toEqual([
        expect.objectContaining({
          careTeamId,
          role: 'Nurse',
          memberReference: 'Practitioner/n',
          onBehalfOfReference: 'Organization/o',
          periodStart: 'ps',
          periodEnd: 'pe',
        }),
      ]);
      expect(refs(result, 'CareTeam', 'reasonReference')).toEqual([
        'Condition/c',
      ]);
      expect(refs(result, 'CareTeam', 'managingOrganization')).toEqual([
        'Organization/m',
      ]);
      expect(refs(result, 'CareTeam', 'identifier')).toEqual(['ctid']);
      expect(concepts(result, 'CareTeam', 'category')).toHaveLength(1);
      expect(concepts(result, 'CareTeam', 'reasonCode')).toHaveLength(1);
      expect(result.telecoms).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
    });
  });

  describe('CarePlan', () => {
    it('normalizes the care plan, activities and related records', () => {
      const result = normalize({
        resourceType: 'CarePlan',
        id: 'cp1',
        status: 'active',
        intent: 'plan',
        title: 'Diabetes',
        description: 'Manage it',
        subject: ref('Patient/p1'),
        encounter: ref('Encounter/e1'),
        period: { start: 's', end: 'e' },
        created: 'c',
        author: ref('Practitioner/a'),
        activity: [
          {
            outcomeCodeableConcept: [{ text: 'better' }],
            outcomeReference: [ref('Observation/o')],
            progress: [{ text: 'going well' }],
            reference: ref('ServiceRequest/s'),
            detail: {
              kind: 'ServiceRequest',
              code: coding('walk', 'Walk'),
              status: 'in-progress',
              statusReason: coding('sr'),
              doNotPerform: false,
              scheduled: { start: 'ss', end: 'se' },
              location: ref('Location/l'),
              performer: [ref('Practitioner/p')],
              product: { coding: [{ code: 'x' }], text: 'Product' },
              dailyAmount: { value: 2, unit: 'tab' },
              quantity: { value: 60, unit: 'tab' },
              description: 'Walk daily',
            },
          },
          { detail: { scheduled: '2024-01-01', product: ref('Medication/m') } },
          {},
        ],
        identifier: [{ value: 'cpid' }],
        basedOn: [ref('a')],
        replaces: [ref('b')],
        partOf: [ref('c')],
        category: [coding('assess-plan')],
        contributor: [ref('d')],
        careTeam: [ref('CareTeam/1')],
        addresses: [ref('Condition/1')],
        supportingInfo: [ref('e')],
        goal: [ref('Goal/1')],
        note: [note('plan note')],
      });
      const carePlanId = result.carePlans[0].id;

      expect(result.carePlans[0]).toEqual(
        expect.objectContaining({
          resourceId: 'cp1',
          status: 'active',
          intent: 'plan',
          title: 'Diabetes',
          description: 'Manage it',
          subjectReference: 'Patient/p1',
          encounterReference: 'Encounter/e1',
          periodStart: 's',
          periodEnd: 'e',
          created: 'c',
          authorReference: 'Practitioner/a',
        }),
      );
      expect(result.carePlanActivities).toEqual([
        expect.objectContaining({
          carePlanId,
          outcomeCodeableConcept: 'better',
          outcomeReference: 'Observation/o',
          progress: 'going well',
          reference: 'ServiceRequest/s',
          kind: 'ServiceRequest',
          code: 'Walk',
          status: 'in-progress',
          statusReason: 'sr',
          doNotPerform: false,
          scheduledDateTime: undefined,
          scheduledPeriodStart: 'ss',
          scheduledPeriodEnd: 'se',
          locationReference: 'Location/l',
          performerReference: 'Practitioner/p',
          productCodeableConcept: 'Product',
          productReference: undefined,
          dailyAmountValue: 2,
          dailyAmountUnit: 'tab',
          quantityValue: 60,
          quantityUnit: 'tab',
          description: 'Walk daily',
        }),
        expect.objectContaining({
          scheduledDateTime: '2024-01-01',
          scheduledPeriodStart: undefined,
          productCodeableConcept: undefined,
          productReference: 'Medication/m',
          status: 'unknown',
        }),
        expect.objectContaining({
          carePlanId,
          status: 'unknown',
          kind: undefined,
        }),
      ]);
      for (const field of [
        'basedOn',
        'replaces',
        'partOf',
        'contributor',
        'careTeam',
        'addresses',
        'supportingInfo',
        'goal',
        'identifier',
      ]) {
        expect(refs(result, 'CarePlan', field)).toHaveLength(1);
      }
      expect(concepts(result, 'CarePlan', 'category')).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
    });

    it('defaults the subject reference to an empty string', () => {
      const result = normalize({
        resourceType: 'CarePlan',
        status: 'draft',
        intent: 'plan',
        subject: {},
      });
      expect(result.carePlans[0].subjectReference).toBe('');
    });
  });

  describe('shared helpers', () => {
    it('records every coding of a codeable concept with its details', () => {
      const result = normalize({
        resourceType: 'Condition',
        subject: ref('Patient/p'),
        category: [
          {
            text: 'Problem',
            coding: [
              {
                system: 's1',
                version: 'v1',
                code: 'c1',
                display: 'd1',
                userSelected: true,
              },
              { system: 's2', code: 'c2' },
            ],
          },
        ],
      });
      const concept = concepts(result, 'Condition', 'category')[0];

      expect(concept.text).toBe('Problem');
      expect(result.codings).toEqual([
        expect.objectContaining({
          codeableConceptId: concept.id,
          system: 's1',
          version: 'v1',
          code: 'c1',
          display: 'd1',
          userSelected: true,
        }),
        expect.objectContaining({
          codeableConceptId: concept.id,
          system: 's2',
          code: 'c2',
        }),
      ]);
    });

    it('stores references without an identifier as undefined', () => {
      const result = normalize({
        resourceType: 'Encounter',
        class: {},
        basedOn: [{ reference: 'X/1' }],
      });
      expect(result.references[0].identifier).toBeUndefined();
    });

    it('stamps createdAt with the current time', () => {
      jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00.000Z') });
      try {
        const result = normalize({ resourceType: 'Patient' });
        expect(result.bundles[0].createdAt?.toISOString()).toBe(
          '2030-01-01T00:00:00.000Z',
        );
        expect(result.patients[0].updatedAt?.toISOString()).toBe(
          '2030-01-01T00:00:00.000Z',
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
