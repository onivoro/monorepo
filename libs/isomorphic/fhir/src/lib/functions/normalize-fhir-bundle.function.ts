import { v4 as uuidv4 } from 'uuid';
import {
  IFhirBundle,
  IFhirResource,
  IFhirPatient,
  IFhirPractitioner,
  IFhirOrganization,
  IFhirEncounter,
  IFhirCondition,
  IFhirObservation,
  IFhirMedicationRequest,
  IFhirProcedure,
  IFhirImmunization,
  IFhirAllergyIntolerance,
  IFhirDiagnosticReport,
  IFhirLocation,
  IFhirAppointment,
  IFhirCareTeam,
  IFhirCarePlan,
  IFhirHumanName,
  IFhirAddress,
  IFhirContactPoint,
  IFhirCodeableConcept,
  IFhirCoding,
  IFhirReference,
  IFhirIdentifier,
  IFhirAnnotation,
  IFhirAttachment,
} from '../interfaces/fhir-resources.interface';
import {
  INormalizedFhirData,
  IBundleTable,
  IBundleEntryTable,
  IPatientTable,
  IPatientIdentifierTable,
  IPatientNameTable,
  IPatientContactTable,
  IPractitionerTable,
  IPractitionerQualificationTable,
  IOrganizationTable,
  IOrganizationTypeTable,
  ILocationTable,
  IEncounterTable,
  IEncounterParticipantTable,
  IConditionTable,
  IObservationTable,
  IObservationComponentTable,
  IMedicationRequestTable,
  IMedicationDosageTable,
  IProcedureTable,
  IProcedurePerformerTable,
  IImmunizationTable,
  IAllergyIntoleranceTable,
  IAllergyReactionTable,
  IAllergyManifestationTable,
  IDiagnosticReportTable,
  IDiagnosticReportResultTable,
  IAppointmentTable,
  IAppointmentParticipantTable,
  ICareTeamTable,
  ICareTeamParticipantTable,
  ICarePlanTable,
  ICarePlanActivityTable,
  IAddressTable,
  ITelecomTable,
  ICodeableConceptTable,
  ICodingTable,
  INoteTable,
  IAttachmentTable,
  IReferenceTable,
} from '../interfaces/fhir-normalized-tables.interface';

export function normalizeFhirBundle(bundle: IFhirBundle): INormalizedFhirData {
  const result: INormalizedFhirData = {
    bundles: [],
    bundleEntries: [],
    patients: [],
    patientIdentifiers: [],
    patientNames: [],
    patientContacts: [],
    practitioners: [],
    practitionerQualifications: [],
    organizations: [],
    organizationTypes: [],
    locations: [],
    encounters: [],
    encounterParticipants: [],
    conditions: [],
    observations: [],
    observationComponents: [],
    medicationRequests: [],
    medicationDosages: [],
    procedures: [],
    procedurePerformers: [],
    immunizations: [],
    allergyIntolerances: [],
    allergyReactions: [],
    allergyManifestations: [],
    diagnosticReports: [],
    diagnosticReportResults: [],
    appointments: [],
    appointmentParticipants: [],
    careTeams: [],
    careTeamParticipants: [],
    carePlans: [],
    carePlanActivities: [],
    addresses: [],
    telecoms: [],
    codeableConcepts: [],
    codings: [],
    notes: [],
    attachments: [],
    references: [],
  };

  // Normalize bundle
  const bundleId = uuidv4();
  const bundleRecord: IBundleTable = {
    id: bundleId,
    resourceId: bundle.id,
    type: bundle.type,
    timestamp: bundle.timestamp,
    total: bundle.total,
    createdAt: new Date(),
  };
  result.bundles.push(bundleRecord);

  // Process bundle entries
  if (bundle.entry) {
    bundle.entry.forEach((entry, index) => {
      const entryId = uuidv4();
      const entryRecord: IBundleEntryTable = {
        id: entryId,
        bundleId: bundleId,
        fullUrl: entry.fullUrl,
        searchMode: entry.search?.mode,
        searchScore: entry.search?.score,
        createdAt: new Date(),
      };

      if (entry.resource) {
        entryRecord.resourceType = entry.resource.resourceType;
        entryRecord.resourceId = entry.resource.id;

        // Process the resource based on its type
        processResource(entry.resource, result);
      }

      result.bundleEntries.push(entryRecord);
    });
  }

  return result;
}

function processResource(resource: IFhirResource, result: INormalizedFhirData): void {
  switch (resource.resourceType) {
    case 'Patient':
      processPatient(resource as IFhirPatient, result);
      break;
    case 'Practitioner':
      processPractitioner(resource as IFhirPractitioner, result);
      break;
    case 'Organization':
      processOrganization(resource as IFhirOrganization, result);
      break;
    case 'Encounter':
      processEncounter(resource as IFhirEncounter, result);
      break;
    case 'Condition':
      processCondition(resource as IFhirCondition, result);
      break;
    case 'Observation':
      processObservation(resource as IFhirObservation, result);
      break;
    case 'MedicationRequest':
      processMedicationRequest(resource as IFhirMedicationRequest, result);
      break;
    case 'Procedure':
      processProcedure(resource as IFhirProcedure, result);
      break;
    case 'Immunization':
      processImmunization(resource as IFhirImmunization, result);
      break;
    case 'AllergyIntolerance':
      processAllergyIntolerance(resource as IFhirAllergyIntolerance, result);
      break;
    case 'DiagnosticReport':
      processDiagnosticReport(resource as IFhirDiagnosticReport, result);
      break;
    case 'Location':
      processLocation(resource as IFhirLocation, result);
      break;
    case 'Appointment':
      processAppointment(resource as IFhirAppointment, result);
      break;
    case 'CareTeam':
      processCareTeam(resource as IFhirCareTeam, result);
      break;
    case 'CarePlan':
      processCarePlan(resource as IFhirCarePlan, result);
      break;
  }
}

function processPatient(patient: IFhirPatient, result: INormalizedFhirData): void {
  const patientId = uuidv4();

  // Main patient record
  const patientRecord: IPatientTable = {
    id: patientId,
    resourceId: patient.id,
    active: patient.active,
    gender: patient.gender,
    birthDate: patient.birthDate,
    deceased: typeof patient.deceased === 'boolean' ? patient.deceased : undefined,
    deceasedDateTime: typeof patient.deceased === 'string' ? patient.deceased : undefined,
    maritalStatus: patient.maritalStatus?.text || patient.maritalStatus?.coding?.[0]?.display,
    multipleBirth: typeof patient.multipleBirth === 'boolean' ? patient.multipleBirth : undefined,
    multipleBirthInteger: typeof patient.multipleBirth === 'number' ? patient.multipleBirth : undefined,
    managingOrganizationId: patient.managingOrganization?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.patients.push(patientRecord);

  // Process identifiers
  if (patient.identifier) {
    patient.identifier.forEach(identifier => {
      result.patientIdentifiers.push({
        id: uuidv4(),
        patientId: patientId,
        use: identifier.use,
        system: identifier.system,
        value: identifier.value,
        periodStart: identifier.period?.start,
        periodEnd: identifier.period?.end,
        assignerReference: identifier.assigner?.reference,
        createdAt: new Date(),
      });
    });
  }

  // Process names
  if (patient.name) {
    patient.name.forEach(name => {
      result.patientNames.push({
        id: uuidv4(),
        patientId: patientId,
        use: name.use,
        text: name.text,
        family: name.family,
        given: name.given?.join(' '),
        prefix: name.prefix?.join(' '),
        suffix: name.suffix?.join(' '),
        periodStart: name.period?.start,
        periodEnd: name.period?.end,
        createdAt: new Date(),
      });
    });
  }

  // Process addresses
  if (patient.address) {
    patient.address.forEach(address => {
      processAddress('Patient', patientId, address, result);
    });
  }

  // Process telecom
  if (patient.telecom) {
    patient.telecom.forEach(telecom => {
      processTelecom('Patient', patientId, telecom, result);
    });
  }

  // Process contacts
  if (patient.contact) {
    patient.contact.forEach(contact => {
      const contactId = uuidv4();
      result.patientContacts.push({
        id: contactId,
        patientId: patientId,
        relationshipCode: contact.relationship?.[0]?.coding?.[0]?.code,
        relationshipText: contact.relationship?.[0]?.text,
        name: contact.name?.text || `${contact.name?.given?.join(' ')} ${contact.name?.family}`.trim(),
        gender: contact.gender,
        organizationReference: contact.organization?.reference,
        periodStart: contact.period?.start,
        periodEnd: contact.period?.end,
        createdAt: new Date(),
      });

      // Process contact's telecom and address
      if (contact.telecom) {
        contact.telecom.forEach(telecom => {
          processTelecom('PatientContact', contactId, telecom, result);
        });
      }
      if (contact.address) {
        processAddress('PatientContact', contactId, contact.address, result);
      }
    });
  }

  // Process general practitioner references
  if (patient.generalPractitioner) {
    patient.generalPractitioner.forEach(gp => {
      processReference('Patient', patientId, 'generalPractitioner', gp, result);
    });
  }

  // Process photo attachments
  if (patient.photo) {
    patient.photo.forEach(photo => {
      processAttachment('Patient', patientId, 'photo', photo, result);
    });
  }

  // Process marital status
  if (patient.maritalStatus) {
    processCodeableConcept('Patient', patientId, 'maritalStatus', patient.maritalStatus, result);
  }
}

function processPractitioner(practitioner: IFhirPractitioner, result: INormalizedFhirData): void {
  const practitionerId = uuidv4();

  const practitionerRecord: IPractitionerTable = {
    id: practitionerId,
    resourceId: practitioner.id,
    active: practitioner.active,
    gender: practitioner.gender,
    birthDate: practitioner.birthDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.practitioners.push(practitionerRecord);

  // Process qualifications
  if (practitioner.qualification) {
    practitioner.qualification.forEach(qual => {
      result.practitionerQualifications.push({
        id: uuidv4(),
        practitionerId: practitionerId,
        code: qual.code.coding?.[0]?.code,
        codeSystem: qual.code.coding?.[0]?.system,
        codeDisplay: qual.code.coding?.[0]?.display || qual.code.text,
        periodStart: qual.period?.start,
        periodEnd: qual.period?.end,
        issuerReference: qual.issuer?.reference,
        createdAt: new Date(),
      });
    });
  }

  // Process other fields similar to patient
  if (practitioner.identifier) {
    practitioner.identifier.forEach(identifier => {
      processIdentifier('Practitioner', practitionerId, identifier, result);
    });
  }

  if (practitioner.name) {
    practitioner.name.forEach(name => {
      processHumanName('Practitioner', practitionerId, name, result);
    });
  }

  if (practitioner.telecom) {
    practitioner.telecom.forEach(telecom => {
      processTelecom('Practitioner', practitionerId, telecom, result);
    });
  }

  if (practitioner.address) {
    practitioner.address.forEach(address => {
      processAddress('Practitioner', practitionerId, address, result);
    });
  }

  if (practitioner.photo) {
    practitioner.photo.forEach(photo => {
      processAttachment('Practitioner', practitionerId, 'photo', photo, result);
    });
  }

  if (practitioner.communication) {
    practitioner.communication.forEach(comm => {
      processCodeableConcept('Practitioner', practitionerId, 'communication', comm, result);
    });
  }
}

function processOrganization(organization: IFhirOrganization, result: INormalizedFhirData): void {
  const organizationId = uuidv4();

  const organizationRecord: IOrganizationTable = {
    id: organizationId,
    resourceId: organization.id,
    active: organization.active,
    name: organization.name,
    partOfReference: organization.partOf?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.organizations.push(organizationRecord);

  // Process organization types
  if (organization.type) {
    organization.type.forEach(type => {
      const coding = type.coding?.[0];
      if (coding) {
        result.organizationTypes.push({
          id: uuidv4(),
          organizationId: organizationId,
          system: coding.system,
          code: coding.code,
          display: coding.display || type.text,
          createdAt: new Date(),
        });
      }
    });
  }

  // Process other fields
  if (organization.identifier) {
    organization.identifier.forEach(identifier => {
      processIdentifier('Organization', organizationId, identifier, result);
    });
  }

  if (organization.telecom) {
    organization.telecom.forEach(telecom => {
      processTelecom('Organization', organizationId, telecom, result);
    });
  }

  if (organization.address) {
    organization.address.forEach(address => {
      processAddress('Organization', organizationId, address, result);
    });
  }

  if (organization.endpoint) {
    organization.endpoint.forEach(endpoint => {
      processReference('Organization', organizationId, 'endpoint', endpoint, result);
    });
  }
}

function processEncounter(encounter: IFhirEncounter, result: INormalizedFhirData): void {
  const encounterId = uuidv4();

  const encounterRecord: IEncounterTable = {
    id: encounterId,
    resourceId: encounter.id,
    status: encounter.status,
    class: encounter.class.code || '',
    classSystem: encounter.class.system,
    classDisplay: encounter.class.display,
    serviceType: encounter.serviceType?.coding?.[0]?.display || encounter.serviceType?.text,
    priority: encounter.priority?.coding?.[0]?.code,
    subjectReference: encounter.subject?.reference,
    episodeOfCareReference: encounter.episodeOfCare?.[0]?.reference,
    serviceProviderReference: encounter.serviceProvider?.reference,
    partOfReference: encounter.partOf?.reference,
    periodStart: encounter.period?.start,
    periodEnd: encounter.period?.end,
    lengthValue: encounter.length?.value,
    lengthUnit: encounter.length?.unit,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.encounters.push(encounterRecord);

  // Process participants
  if (encounter.participant) {
    encounter.participant.forEach(participant => {
      result.encounterParticipants.push({
        id: uuidv4(),
        encounterId: encounterId,
        typeCode: participant.type?.[0]?.coding?.[0]?.code,
        typeDisplay: participant.type?.[0]?.coding?.[0]?.display || participant.type?.[0]?.text,
        individualReference: participant.individual?.reference,
        periodStart: participant.period?.start,
        periodEnd: participant.period?.end,
        createdAt: new Date(),
      });
    });
  }

  // Process subject reference
  if (encounter.subject) {
    processReference('Encounter', encounterId, 'subject', encounter.subject, result);
  }

  // Process other references
  if (encounter.identifier) {
    encounter.identifier.forEach(identifier => {
      processIdentifier('Encounter', encounterId, identifier, result);
    });
  }

  if (encounter.basedOn) {
    encounter.basedOn.forEach(ref => {
      processReference('Encounter', encounterId, 'basedOn', ref, result);
    });
  }

  if (encounter.appointment) {
    encounter.appointment.forEach(ref => {
      processReference('Encounter', encounterId, 'appointment', ref, result);
    });
  }

  if (encounter.reasonCode) {
    encounter.reasonCode.forEach(reason => {
      processCodeableConcept('Encounter', encounterId, 'reasonCode', reason, result);
    });
  }

  if (encounter.reasonReference) {
    encounter.reasonReference.forEach(ref => {
      processReference('Encounter', encounterId, 'reasonReference', ref, result);
    });
  }
}

function processCondition(condition: IFhirCondition, result: INormalizedFhirData): void {
  const conditionId = uuidv4();

  const conditionRecord: IConditionTable = {
    id: conditionId,
    resourceId: condition.id,
    clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code,
    verificationStatus: condition.verificationStatus?.coding?.[0]?.code,
    severity: condition.severity?.coding?.[0]?.code,
    code: condition.code?.coding?.[0]?.code,
    codeSystem: condition.code?.coding?.[0]?.system,
    codeDisplay: condition.code?.coding?.[0]?.display || condition.code?.text,
    subjectReference: condition.subject.reference || '',
    encounterReference: condition.encounter?.reference,
    onsetDateTime: typeof condition.onset === 'string' ? condition.onset : undefined,
    abatementDateTime: typeof condition.abatement === 'string' ? condition.abatement : undefined,
    recordedDate: condition.recordedDate,
    recorderReference: condition.recorder?.reference,
    asserterReference: condition.asserter?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.conditions.push(conditionRecord);

  // Process other fields
  if (condition.identifier) {
    condition.identifier.forEach(identifier => {
      processIdentifier('Condition', conditionId, identifier, result);
    });
  }

  if (condition.category) {
    condition.category.forEach(cat => {
      processCodeableConcept('Condition', conditionId, 'category', cat, result);
    });
  }

  if (condition.bodySite) {
    condition.bodySite.forEach(site => {
      processCodeableConcept('Condition', conditionId, 'bodySite', site, result);
    });
  }

  if (condition.note) {
    condition.note.forEach(note => {
      processNote('Condition', conditionId, note, result);
    });
  }
}

function processObservation(observation: IFhirObservation, result: INormalizedFhirData): void {
  const observationId = uuidv4();

  const observationRecord: IObservationTable = {
    id: observationId,
    resourceId: observation.id,
    status: observation.status,
    code: observation.code.coding?.[0]?.code || '',
    codeSystem: observation.code.coding?.[0]?.system,
    codeDisplay: observation.code.coding?.[0]?.display || observation.code.text,
    subjectReference: observation.subject?.reference,
    encounterReference: observation.encounter?.reference,
    effectiveDateTime: typeof observation.effective === 'string' ? observation.effective : undefined,
    effectivePeriodStart: typeof observation.effective === 'object' && observation.effective && 'start' in observation.effective ? observation.effective.start : undefined,
    effectivePeriodEnd: typeof observation.effective === 'object' && observation.effective && 'end' in observation.effective ? observation.effective.end : undefined,
    issued: observation.issued,
    dataAbsentReason: observation.dataAbsentReason?.coding?.[0]?.code,
    bodySite: observation.bodySite?.coding?.[0]?.display || observation.bodySite?.text,
    method: observation.method?.coding?.[0]?.display || observation.method?.text,
    specimenReference: observation.specimen?.reference,
    deviceReference: observation.device?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Process value based on type
  if (observation.value) {
    if (typeof observation.value === 'string') {
      observationRecord.valueType = 'string';
      observationRecord.valueString = observation.value;
    } else if (typeof observation.value === 'number') {
      observationRecord.valueType = 'number';
      observationRecord.valueNumber = observation.value;
    } else if (typeof observation.value === 'boolean') {
      observationRecord.valueType = 'boolean';
      observationRecord.valueBoolean = observation.value;
    } else if (observation.value.value !== undefined) {
      observationRecord.valueType = 'Quantity';
      observationRecord.valueNumber = observation.value.value;
      observationRecord.valueString = observation.value.unit;
    }
  }

  result.observations.push(observationRecord);

  // Process components
  if (observation.component) {
    observation.component.forEach(component => {
      const componentRecord: IObservationComponentTable = {
        id: uuidv4(),
        observationId: observationId,
        code: component.code.coding?.[0]?.code || '',
        codeSystem: component.code.coding?.[0]?.system,
        codeDisplay: component.code.coding?.[0]?.display || component.code.text,
        dataAbsentReason: component.dataAbsentReason?.coding?.[0]?.code,
        createdAt: new Date(),
      };

      // Process component value
      if (component.value) {
        if (typeof component.value === 'string') {
          componentRecord.valueType = 'string';
          componentRecord.valueString = component.value;
        } else if (typeof component.value === 'number') {
          componentRecord.valueType = 'number';
          componentRecord.valueNumber = component.value;
        } else if (typeof component.value === 'boolean') {
          componentRecord.valueType = 'boolean';
          componentRecord.valueBoolean = component.value;
        } else if (component.value.value !== undefined) {
          componentRecord.valueType = 'Quantity';
          componentRecord.valueNumber = component.value.value;
        }
      }

      result.observationComponents.push(componentRecord);
    });
  }

  // Process other fields
  if (observation.identifier) {
    observation.identifier.forEach(identifier => {
      processIdentifier('Observation', observationId, identifier, result);
    });
  }

  if (observation.basedOn) {
    observation.basedOn.forEach(ref => {
      processReference('Observation', observationId, 'basedOn', ref, result);
    });
  }

  if (observation.partOf) {
    observation.partOf.forEach(ref => {
      processReference('Observation', observationId, 'partOf', ref, result);
    });
  }

  if (observation.category) {
    observation.category.forEach(cat => {
      processCodeableConcept('Observation', observationId, 'category', cat, result);
    });
  }

  if (observation.interpretation) {
    observation.interpretation.forEach(interp => {
      processCodeableConcept('Observation', observationId, 'interpretation', interp, result);
    });
  }

  if (observation.note) {
    observation.note.forEach(note => {
      processNote('Observation', observationId, note, result);
    });
  }

  if (observation.performer) {
    observation.performer.forEach(ref => {
      processReference('Observation', observationId, 'performer', ref, result);
    });
  }

  if (observation.hasMember) {
    observation.hasMember.forEach(ref => {
      processReference('Observation', observationId, 'hasMember', ref, result);
    });
  }

  if (observation.derivedFrom) {
    observation.derivedFrom.forEach(ref => {
      processReference('Observation', observationId, 'derivedFrom', ref, result);
    });
  }
}

function processMedicationRequest(medRequest: IFhirMedicationRequest, result: INormalizedFhirData): void {
  const medRequestId = uuidv4();

  const medRequestRecord: IMedicationRequestTable = {
    id: medRequestId,
    resourceId: medRequest.id,
    status: medRequest.status,
    statusReason: medRequest.statusReason?.coding?.[0]?.code,
    intent: medRequest.intent,
    priority: medRequest.priority,
    doNotPerform: medRequest.doNotPerform,
    medicationCodeableConcept: typeof medRequest.medication === 'object' && 'coding' in medRequest.medication
      ? medRequest.medication.coding?.[0]?.display || medRequest.medication.text
      : undefined,
    medicationReference: typeof medRequest.medication === 'object' && 'reference' in medRequest.medication
      ? medRequest.medication.reference
      : undefined,
    subjectReference: medRequest.subject.reference || '',
    encounterReference: medRequest.encounter?.reference,
    authoredOn: medRequest.authoredOn,
    requesterReference: medRequest.requester?.reference,
    performerReference: medRequest.performer?.reference,
    performerType: medRequest.performerType?.coding?.[0]?.code,
    recorderReference: medRequest.recorder?.reference,
    groupIdentifierValue: medRequest.groupIdentifier?.value,
    courseOfTherapyType: medRequest.courseOfTherapyType?.coding?.[0]?.code,
    priorPrescriptionReference: medRequest.priorPrescription?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.medicationRequests.push(medRequestRecord);

  // Process dosage instructions
  if (medRequest.dosageInstruction) {
    medRequest.dosageInstruction.forEach(dosage => {
      const dosageRecord: IMedicationDosageTable = {
        id: uuidv4(),
        medicationRequestId: medRequestId,
        sequence: dosage.sequence,
        text: dosage.text,
        patientInstruction: dosage.patientInstruction,
        asNeeded: typeof dosage.asNeeded === 'boolean' ? dosage.asNeeded : undefined,
        asNeededCode: typeof dosage.asNeeded === 'object' ? dosage.asNeeded.coding?.[0]?.code : undefined,
        site: dosage.site?.coding?.[0]?.display || dosage.site?.text,
        route: dosage.route?.coding?.[0]?.display || dosage.route?.text,
        method: dosage.method?.coding?.[0]?.display || dosage.method?.text,
        createdAt: new Date(),
      };

      // Process dose and rate
      if (dosage.doseAndRate?.[0]) {
        const doseAndRate = dosage.doseAndRate[0];
        if (doseAndRate.dose && 'value' in doseAndRate.dose) {
          dosageRecord.doseValue = doseAndRate.dose.value;
          dosageRecord.doseUnit = doseAndRate.dose.unit;
          dosageRecord.doseCode = doseAndRate.dose.code;
        }
        if (doseAndRate.rate && 'value' in doseAndRate.rate) {
          dosageRecord.rateValue = doseAndRate.rate.value;
          dosageRecord.rateUnit = doseAndRate.rate.unit;
        }
      }

      result.medicationDosages.push(dosageRecord);
    });
  }

  // Process other fields
  if (medRequest.identifier) {
    medRequest.identifier.forEach(identifier => {
      processIdentifier('MedicationRequest', medRequestId, identifier, result);
    });
  }

  if (medRequest.category) {
    medRequest.category.forEach(cat => {
      processCodeableConcept('MedicationRequest', medRequestId, 'category', cat, result);
    });
  }

  if (medRequest.reasonCode) {
    medRequest.reasonCode.forEach(reason => {
      processCodeableConcept('MedicationRequest', medRequestId, 'reasonCode', reason, result);
    });
  }

  if (medRequest.reasonReference) {
    medRequest.reasonReference.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'reasonReference', ref, result);
    });
  }

  if (medRequest.supportingInformation) {
    medRequest.supportingInformation.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'supportingInformation', ref, result);
    });
  }

  if (medRequest.basedOn) {
    medRequest.basedOn.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'basedOn', ref, result);
    });
  }

  if (medRequest.insurance) {
    medRequest.insurance.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'insurance', ref, result);
    });
  }

  if (medRequest.note) {
    medRequest.note.forEach(note => {
      processNote('MedicationRequest', medRequestId, note, result);
    });
  }

  if (medRequest.detectedIssue) {
    medRequest.detectedIssue.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'detectedIssue', ref, result);
    });
  }

  if (medRequest.eventHistory) {
    medRequest.eventHistory.forEach(ref => {
      processReference('MedicationRequest', medRequestId, 'eventHistory', ref, result);
    });
  }
}

function processProcedure(procedure: IFhirProcedure, result: INormalizedFhirData): void {
  const procedureId = uuidv4();

  const procedureRecord: IProcedureTable = {
    id: procedureId,
    resourceId: procedure.id,
    status: procedure.status,
    statusReason: procedure.statusReason?.coding?.[0]?.code,
    category: procedure.category?.coding?.[0]?.code,
    code: procedure.code?.coding?.[0]?.code,
    codeSystem: procedure.code?.coding?.[0]?.system,
    codeDisplay: procedure.code?.coding?.[0]?.display || procedure.code?.text,
    subjectReference: procedure.subject.reference || '',
    encounterReference: procedure.encounter?.reference,
    performedDateTime: typeof procedure.performed === 'string' ? procedure.performed : undefined,
    performedPeriodStart: typeof procedure.performed === 'object' && 'start' in procedure.performed ? procedure.performed.start : undefined,
    performedPeriodEnd: typeof procedure.performed === 'object' && 'end' in procedure.performed ? procedure.performed.end : undefined,
    recorderReference: procedure.recorder?.reference,
    asserterReference: procedure.asserter?.reference,
    locationReference: procedure.location?.reference,
    outcome: procedure.outcome?.coding?.[0]?.code,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.procedures.push(procedureRecord);

  // Process performers
  if (procedure.performer) {
    procedure.performer.forEach(performer => {
      result.procedurePerformers.push({
        id: uuidv4(),
        procedureId: procedureId,
        function: performer.function?.coding?.[0]?.code,
        actorReference: performer.actor.reference || '',
        onBehalfOfReference: performer.onBehalfOf?.reference,
        createdAt: new Date(),
      });
    });
  }

  // Process other fields
  if (procedure.identifier) {
    procedure.identifier.forEach(identifier => {
      processIdentifier('Procedure', procedureId, identifier, result);
    });
  }

  if (procedure.basedOn) {
    procedure.basedOn.forEach(ref => {
      processReference('Procedure', procedureId, 'basedOn', ref, result);
    });
  }

  if (procedure.partOf) {
    procedure.partOf.forEach(ref => {
      processReference('Procedure', procedureId, 'partOf', ref, result);
    });
  }

  if (procedure.reasonCode) {
    procedure.reasonCode.forEach(reason => {
      processCodeableConcept('Procedure', procedureId, 'reasonCode', reason, result);
    });
  }

  if (procedure.reasonReference) {
    procedure.reasonReference.forEach(ref => {
      processReference('Procedure', procedureId, 'reasonReference', ref, result);
    });
  }

  if (procedure.bodySite) {
    procedure.bodySite.forEach(site => {
      processCodeableConcept('Procedure', procedureId, 'bodySite', site, result);
    });
  }

  if (procedure.report) {
    procedure.report.forEach(ref => {
      processReference('Procedure', procedureId, 'report', ref, result);
    });
  }

  if (procedure.complication) {
    procedure.complication.forEach(comp => {
      processCodeableConcept('Procedure', procedureId, 'complication', comp, result);
    });
  }

  if (procedure.complicationDetail) {
    procedure.complicationDetail.forEach(ref => {
      processReference('Procedure', procedureId, 'complicationDetail', ref, result);
    });
  }

  if (procedure.followUp) {
    procedure.followUp.forEach(followUp => {
      processCodeableConcept('Procedure', procedureId, 'followUp', followUp, result);
    });
  }

  if (procedure.note) {
    procedure.note.forEach(note => {
      processNote('Procedure', procedureId, note, result);
    });
  }

  if (procedure.usedReference) {
    procedure.usedReference.forEach(ref => {
      processReference('Procedure', procedureId, 'usedReference', ref, result);
    });
  }

  if (procedure.usedCode) {
    procedure.usedCode.forEach(code => {
      processCodeableConcept('Procedure', procedureId, 'usedCode', code, result);
    });
  }
}

function processImmunization(immunization: IFhirImmunization, result: INormalizedFhirData): void {
  const immunizationId = uuidv4();

  const immunizationRecord: IImmunizationTable = {
    id: immunizationId,
    resourceId: immunization.id,
    status: immunization.status,
    statusReason: immunization.statusReason?.coding?.[0]?.code,
    vaccineCode: immunization.vaccineCode.coding?.[0]?.code || '',
    vaccineCodeSystem: immunization.vaccineCode.coding?.[0]?.system,
    vaccineCodeDisplay: immunization.vaccineCode.coding?.[0]?.display || immunization.vaccineCode.text,
    patientReference: immunization.patient.reference || '',
    encounterReference: immunization.encounter?.reference,
    occurrenceDateTime: typeof immunization.occurrence === 'string' ? immunization.occurrence : undefined,
    recorded: immunization.recorded,
    primarySource: immunization.primarySource,
    reportOrigin: immunization.reportOrigin?.coding?.[0]?.code,
    locationReference: immunization.location?.reference,
    manufacturerReference: immunization.manufacturer?.reference,
    lotNumber: immunization.lotNumber,
    expirationDate: immunization.expirationDate,
    site: immunization.site?.coding?.[0]?.display || immunization.site?.text,
    route: immunization.route?.coding?.[0]?.display || immunization.route?.text,
    doseQuantityValue: immunization.doseQuantity?.value,
    doseQuantityUnit: immunization.doseQuantity?.unit,
    isSubpotent: immunization.isSubpotent,
    fundingSource: immunization.fundingSource?.coding?.[0]?.code,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.immunizations.push(immunizationRecord);

  // Process other fields
  if (immunization.identifier) {
    immunization.identifier.forEach(identifier => {
      processIdentifier('Immunization', immunizationId, identifier, result);
    });
  }

  if (immunization.reasonCode) {
    immunization.reasonCode.forEach(reason => {
      processCodeableConcept('Immunization', immunizationId, 'reasonCode', reason, result);
    });
  }

  if (immunization.reasonReference) {
    immunization.reasonReference.forEach(ref => {
      processReference('Immunization', immunizationId, 'reasonReference', ref, result);
    });
  }

  if (immunization.subpotentReason) {
    immunization.subpotentReason.forEach(reason => {
      processCodeableConcept('Immunization', immunizationId, 'subpotentReason', reason, result);
    });
  }

  if (immunization.programEligibility) {
    immunization.programEligibility.forEach(prog => {
      processCodeableConcept('Immunization', immunizationId, 'programEligibility', prog, result);
    });
  }

  if (immunization.note) {
    immunization.note.forEach(note => {
      processNote('Immunization', immunizationId, note, result);
    });
  }
}

function processAllergyIntolerance(allergy: IFhirAllergyIntolerance, result: INormalizedFhirData): void {
  const allergyId = uuidv4();

  const allergyRecord: IAllergyIntoleranceTable = {
    id: allergyId,
    resourceId: allergy.id,
    clinicalStatus: allergy.clinicalStatus?.coding?.[0]?.code,
    verificationStatus: allergy.verificationStatus?.coding?.[0]?.code,
    type: allergy.type,
    criticality: allergy.criticality,
    code: allergy.code?.coding?.[0]?.code,
    codeSystem: allergy.code?.coding?.[0]?.system,
    codeDisplay: allergy.code?.coding?.[0]?.display || allergy.code?.text,
    patientReference: allergy.patient.reference || '',
    encounterReference: allergy.encounter?.reference,
    onsetDateTime: typeof allergy.onset === 'string' ? allergy.onset : undefined,
    recordedDate: allergy.recordedDate,
    recorderReference: allergy.recorder?.reference,
    asserterReference: allergy.asserter?.reference,
    lastOccurrence: allergy.lastOccurrence,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.allergyIntolerances.push(allergyRecord);

  // Process reactions
  if (allergy.reaction) {
    allergy.reaction.forEach(reaction => {
      const reactionId = uuidv4();
      const reactionRecord: IAllergyReactionTable = {
        id: reactionId,
        allergyIntoleranceId: allergyId,
        substance: reaction.substance?.coding?.[0]?.display || reaction.substance?.text,
        description: reaction.description,
        onset: reaction.onset,
        severity: reaction.severity,
        exposureRoute: reaction.exposureRoute?.coding?.[0]?.display || reaction.exposureRoute?.text,
        createdAt: new Date(),
      };
      result.allergyReactions.push(reactionRecord);

      // Process manifestations
      if (reaction.manifestation) {
        reaction.manifestation.forEach(manifestation => {
          result.allergyManifestations.push({
            id: uuidv4(),
            allergyReactionId: reactionId,
            code: manifestation.coding?.[0]?.code,
            codeSystem: manifestation.coding?.[0]?.system,
            codeDisplay: manifestation.coding?.[0]?.display || manifestation.text,
            createdAt: new Date(),
          });
        });
      }

      // Process reaction notes
      if (reaction.note) {
        reaction.note.forEach(note => {
          processNote('AllergyReaction', reactionId, note, result);
        });
      }
    });
  }

  // Process other fields
  if (allergy.identifier) {
    allergy.identifier.forEach(identifier => {
      processIdentifier('AllergyIntolerance', allergyId, identifier, result);
    });
  }

  if (allergy.category) {
    allergy.category.forEach(cat => {
      processCodeableConcept('AllergyIntolerance', allergyId, 'category', { text: cat }, result);
    });
  }

  if (allergy.note) {
    allergy.note.forEach(note => {
      processNote('AllergyIntolerance', allergyId, note, result);
    });
  }
}

function processDiagnosticReport(report: IFhirDiagnosticReport, result: INormalizedFhirData): void {
  const reportId = uuidv4();

  const reportRecord: IDiagnosticReportTable = {
    id: reportId,
    resourceId: report.id,
    status: report.status,
    code: report.code.coding?.[0]?.code || '',
    codeSystem: report.code.coding?.[0]?.system,
    codeDisplay: report.code.coding?.[0]?.display || report.code.text,
    subjectReference: report.subject?.reference,
    encounterReference: report.encounter?.reference,
    effectiveDateTime: typeof report.effective === 'string' ? report.effective : undefined,
    effectivePeriodStart: typeof report.effective === 'object' ? report.effective.start : undefined,
    effectivePeriodEnd: typeof report.effective === 'object' ? report.effective.end : undefined,
    issued: report.issued,
    conclusion: report.conclusion,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.diagnosticReports.push(reportRecord);

  // Process results
  if (report.result) {
    report.result.forEach(resultRef => {
      result.diagnosticReportResults.push({
        id: uuidv4(),
        diagnosticReportId: reportId,
        resultReference: resultRef.reference || '',
        createdAt: new Date(),
      });
    });
  }

  // Process other fields
  if (report.identifier) {
    report.identifier.forEach(identifier => {
      processIdentifier('DiagnosticReport', reportId, identifier, result);
    });
  }

  if (report.basedOn) {
    report.basedOn.forEach(ref => {
      processReference('DiagnosticReport', reportId, 'basedOn', ref, result);
    });
  }

  if (report.category) {
    report.category.forEach(cat => {
      processCodeableConcept('DiagnosticReport', reportId, 'category', cat, result);
    });
  }

  if (report.performer) {
    report.performer.forEach(ref => {
      processReference('DiagnosticReport', reportId, 'performer', ref, result);
    });
  }

  if (report.resultsInterpreter) {
    report.resultsInterpreter.forEach(ref => {
      processReference('DiagnosticReport', reportId, 'resultsInterpreter', ref, result);
    });
  }

  if (report.specimen) {
    report.specimen.forEach(ref => {
      processReference('DiagnosticReport', reportId, 'specimen', ref, result);
    });
  }

  if (report.imagingStudy) {
    report.imagingStudy.forEach(ref => {
      processReference('DiagnosticReport', reportId, 'imagingStudy', ref, result);
    });
  }

  if (report.conclusionCode) {
    report.conclusionCode.forEach(code => {
      processCodeableConcept('DiagnosticReport', reportId, 'conclusionCode', code, result);
    });
  }

  if (report.presentedForm) {
    report.presentedForm.forEach(form => {
      processAttachment('DiagnosticReport', reportId, 'presentedForm', form, result);
    });
  }
}

function processLocation(location: IFhirLocation, result: INormalizedFhirData): void {
  const locationId = uuidv4();

  const locationRecord: ILocationTable = {
    id: locationId,
    resourceId: location.id,
    status: location.status,
    operationalStatus: location.operationalStatus?.code,
    name: location.name,
    description: location.description,
    mode: location.mode,
    physicalType: location.physicalType?.coding?.[0]?.display || location.physicalType?.text,
    latitude: location.position?.latitude,
    longitude: location.position?.longitude,
    altitude: location.position?.altitude,
    managingOrganizationReference: location.managingOrganization?.reference,
    partOfReference: location.partOf?.reference,
    availabilityExceptions: location.availabilityExceptions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.locations.push(locationRecord);

  // Process other fields
  if (location.identifier) {
    location.identifier.forEach(identifier => {
      processIdentifier('Location', locationId, identifier, result);
    });
  }

  if (location.alias) {
    location.alias.forEach((alias, index) => {
      processCodeableConcept('Location', locationId, `alias[${index}]`, { text: alias }, result);
    });
  }

  if (location.type) {
    location.type.forEach(type => {
      processCodeableConcept('Location', locationId, 'type', type, result);
    });
  }

  if (location.telecom) {
    location.telecom.forEach(telecom => {
      processTelecom('Location', locationId, telecom, result);
    });
  }

  if (location.address) {
    processAddress('Location', locationId, location.address, result);
  }

  if (location.endpoint) {
    location.endpoint.forEach(ref => {
      processReference('Location', locationId, 'endpoint', ref, result);
    });
  }
}

function processAppointment(appointment: IFhirAppointment, result: INormalizedFhirData): void {
  const appointmentId = uuidv4();

  const appointmentRecord: IAppointmentTable = {
    id: appointmentId,
    resourceId: appointment.id,
    status: appointment.status,
    cancelationReason: appointment.cancelationReason?.coding?.[0]?.code,
    serviceCategory: appointment.serviceCategory?.[0]?.coding?.[0]?.display || appointment.serviceCategory?.[0]?.text,
    serviceType: appointment.serviceType?.[0]?.coding?.[0]?.display || appointment.serviceType?.[0]?.text,
    specialty: appointment.specialty?.[0]?.coding?.[0]?.display || appointment.specialty?.[0]?.text,
    appointmentType: appointment.appointmentType?.coding?.[0]?.display || appointment.appointmentType?.text,
    priority: appointment.priority,
    description: appointment.description,
    start: appointment.start,
    end: appointment.end,
    minutesDuration: appointment.minutesDuration,
    created: appointment.created,
    comment: appointment.comment,
    patientInstruction: appointment.patientInstruction,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.appointments.push(appointmentRecord);

  // Process participants
  if (appointment.participant) {
    appointment.participant.forEach(participant => {
      result.appointmentParticipants.push({
        id: uuidv4(),
        appointmentId: appointmentId,
        type: participant.type?.[0]?.coding?.[0]?.code,
        actorReference: participant.actor?.reference,
        required: participant.required,
        status: participant.status,
        periodStart: participant.period?.start,
        periodEnd: participant.period?.end,
        createdAt: new Date(),
      });
    });
  }

  // Process other fields
  if (appointment.identifier) {
    appointment.identifier.forEach(identifier => {
      processIdentifier('Appointment', appointmentId, identifier, result);
    });
  }

  if (appointment.reasonCode) {
    appointment.reasonCode.forEach(reason => {
      processCodeableConcept('Appointment', appointmentId, 'reasonCode', reason, result);
    });
  }

  if (appointment.reasonReference) {
    appointment.reasonReference.forEach(ref => {
      processReference('Appointment', appointmentId, 'reasonReference', ref, result);
    });
  }

  if (appointment.supportingInformation) {
    appointment.supportingInformation.forEach(ref => {
      processReference('Appointment', appointmentId, 'supportingInformation', ref, result);
    });
  }

  if (appointment.slot) {
    appointment.slot.forEach(ref => {
      processReference('Appointment', appointmentId, 'slot', ref, result);
    });
  }

  if (appointment.basedOn) {
    appointment.basedOn.forEach(ref => {
      processReference('Appointment', appointmentId, 'basedOn', ref, result);
    });
  }
}

function processCareTeam(careTeam: IFhirCareTeam, result: INormalizedFhirData): void {
  const careTeamId = uuidv4();

  const careTeamRecord: ICareTeamTable = {
    id: careTeamId,
    resourceId: careTeam.id,
    status: careTeam.status,
    name: careTeam.name,
    subjectReference: careTeam.subject?.reference,
    encounterReference: careTeam.encounter?.reference,
    periodStart: careTeam.period?.start,
    periodEnd: careTeam.period?.end,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.careTeams.push(careTeamRecord);

  // Process participants
  if (careTeam.participant) {
    careTeam.participant.forEach(participant => {
      result.careTeamParticipants.push({
        id: uuidv4(),
        careTeamId: careTeamId,
        role: participant.role?.[0]?.coding?.[0]?.display || participant.role?.[0]?.text,
        memberReference: participant.member?.reference,
        onBehalfOfReference: participant.onBehalfOf?.reference,
        periodStart: participant.period?.start,
        periodEnd: participant.period?.end,
        createdAt: new Date(),
      });
    });
  }

  // Process other fields
  if (careTeam.identifier) {
    careTeam.identifier.forEach(identifier => {
      processIdentifier('CareTeam', careTeamId, identifier, result);
    });
  }

  if (careTeam.category) {
    careTeam.category.forEach(cat => {
      processCodeableConcept('CareTeam', careTeamId, 'category', cat, result);
    });
  }

  if (careTeam.reasonCode) {
    careTeam.reasonCode.forEach(reason => {
      processCodeableConcept('CareTeam', careTeamId, 'reasonCode', reason, result);
    });
  }

  if (careTeam.reasonReference) {
    careTeam.reasonReference.forEach(ref => {
      processReference('CareTeam', careTeamId, 'reasonReference', ref, result);
    });
  }

  if (careTeam.managingOrganization) {
    careTeam.managingOrganization.forEach(ref => {
      processReference('CareTeam', careTeamId, 'managingOrganization', ref, result);
    });
  }

  if (careTeam.telecom) {
    careTeam.telecom.forEach(telecom => {
      processTelecom('CareTeam', careTeamId, telecom, result);
    });
  }

  if (careTeam.note) {
    careTeam.note.forEach(note => {
      processNote('CareTeam', careTeamId, note, result);
    });
  }
}

function processCarePlan(carePlan: IFhirCarePlan, result: INormalizedFhirData): void {
  const carePlanId = uuidv4();

  const carePlanRecord: ICarePlanTable = {
    id: carePlanId,
    resourceId: carePlan.id,
    status: carePlan.status,
    intent: carePlan.intent,
    title: carePlan.title,
    description: carePlan.description,
    subjectReference: carePlan.subject.reference || '',
    encounterReference: carePlan.encounter?.reference,
    periodStart: carePlan.period?.start,
    periodEnd: carePlan.period?.end,
    created: carePlan.created,
    authorReference: carePlan.author?.reference,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.carePlans.push(carePlanRecord);

  // Process activities
  if (carePlan.activity) {
    carePlan.activity.forEach(activity => {
      const activityRecord: ICarePlanActivityTable = {
        id: uuidv4(),
        carePlanId: carePlanId,
        outcomeCodeableConcept: activity.outcomeCodeableConcept?.[0]?.text,
        outcomeReference: activity.outcomeReference?.[0]?.reference,
        progress: activity.progress?.[0]?.text,
        reference: activity.reference?.reference,
        kind: activity.detail?.kind,
        code: activity.detail?.code?.coding?.[0]?.display || activity.detail?.code?.text,
        status: activity.detail?.status || 'unknown',
        statusReason: activity.detail?.statusReason?.coding?.[0]?.code,
        doNotPerform: activity.detail?.doNotPerform,
        scheduledDateTime: typeof activity.detail?.scheduled === 'string' ? activity.detail.scheduled : undefined,
        scheduledPeriodStart: typeof activity.detail?.scheduled === 'object' && 'start' in activity.detail.scheduled ? activity.detail.scheduled.start : undefined,
        scheduledPeriodEnd: typeof activity.detail?.scheduled === 'object' && 'end' in activity.detail.scheduled ? activity.detail.scheduled.end : undefined,
        locationReference: activity.detail?.location?.reference,
        performerReference: activity.detail?.performer?.[0]?.reference,
        productCodeableConcept: typeof activity.detail?.product === 'object' && 'coding' in activity.detail.product ? activity.detail.product.text : undefined,
        productReference: typeof activity.detail?.product === 'object' && 'reference' in activity.detail.product ? activity.detail.product.reference : undefined,
        dailyAmountValue: activity.detail?.dailyAmount?.value,
        dailyAmountUnit: activity.detail?.dailyAmount?.unit,
        quantityValue: activity.detail?.quantity?.value,
        quantityUnit: activity.detail?.quantity?.unit,
        description: activity.detail?.description,
        createdAt: new Date(),
      };
      result.carePlanActivities.push(activityRecord);
    });
  }

  // Process other fields
  if (carePlan.identifier) {
    carePlan.identifier.forEach(identifier => {
      processIdentifier('CarePlan', carePlanId, identifier, result);
    });
  }

  if (carePlan.basedOn) {
    carePlan.basedOn.forEach(ref => {
      processReference('CarePlan', carePlanId, 'basedOn', ref, result);
    });
  }

  if (carePlan.replaces) {
    carePlan.replaces.forEach(ref => {
      processReference('CarePlan', carePlanId, 'replaces', ref, result);
    });
  }

  if (carePlan.partOf) {
    carePlan.partOf.forEach(ref => {
      processReference('CarePlan', carePlanId, 'partOf', ref, result);
    });
  }

  if (carePlan.category) {
    carePlan.category.forEach(cat => {
      processCodeableConcept('CarePlan', carePlanId, 'category', cat, result);
    });
  }

  if (carePlan.contributor) {
    carePlan.contributor.forEach(ref => {
      processReference('CarePlan', carePlanId, 'contributor', ref, result);
    });
  }

  if (carePlan.careTeam) {
    carePlan.careTeam.forEach(ref => {
      processReference('CarePlan', carePlanId, 'careTeam', ref, result);
    });
  }

  if (carePlan.addresses) {
    carePlan.addresses.forEach(ref => {
      processReference('CarePlan', carePlanId, 'addresses', ref, result);
    });
  }

  if (carePlan.supportingInfo) {
    carePlan.supportingInfo.forEach(ref => {
      processReference('CarePlan', carePlanId, 'supportingInfo', ref, result);
    });
  }

  if (carePlan.goal) {
    carePlan.goal.forEach(ref => {
      processReference('CarePlan', carePlanId, 'goal', ref, result);
    });
  }

  if (carePlan.note) {
    carePlan.note.forEach(note => {
      processNote('CarePlan', carePlanId, note, result);
    });
  }
}

// Helper functions for common data types
function processAddress(resourceType: string, resourceId: string, address: IFhirAddress, result: INormalizedFhirData): void {
  const addressRecord: IAddressTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    use: address.use,
    type: address.type,
    text: address.text,
    line: address.line?.join('\n'),
    city: address.city,
    district: address.district,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    periodStart: address.period?.start,
    periodEnd: address.period?.end,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  result.addresses.push(addressRecord);
}

function processTelecom(resourceType: string, resourceId: string, telecom: IFhirContactPoint, result: INormalizedFhirData): void {
  const telecomRecord: ITelecomTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    system: telecom.system,
    value: telecom.value,
    use: telecom.use,
    rank: telecom.rank,
    periodStart: telecom.period?.start,
    periodEnd: telecom.period?.end,
    createdAt: new Date(),
  };
  result.telecoms.push(telecomRecord);
}

function processCodeableConcept(resourceType: string, resourceId: string, fieldName: string, concept: IFhirCodeableConcept, result: INormalizedFhirData): void {
  const conceptId = uuidv4();
  const conceptRecord: ICodeableConceptTable = {
    id: conceptId,
    resourceType: resourceType,
    resourceId: resourceId,
    fieldName: fieldName,
    text: concept.text,
    createdAt: new Date(),
  };
  result.codeableConcepts.push(conceptRecord);

  // Process codings
  if (concept.coding) {
    concept.coding.forEach(coding => {
      const codingRecord: ICodingTable = {
        id: uuidv4(),
        codeableConceptId: conceptId,
        system: coding.system,
        version: coding.version,
        code: coding.code,
        display: coding.display,
        userSelected: coding.userSelected,
        createdAt: new Date(),
      };
      result.codings.push(codingRecord);
    });
  }
}

function processReference(resourceType: string, resourceId: string, fieldName: string, reference: IFhirReference, result: INormalizedFhirData): void {
  const referenceRecord: IReferenceTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    fieldName: fieldName,
    reference: reference.reference,
    type: reference.type,
    identifier: reference.identifier ? JSON.stringify(reference.identifier) : undefined,
    display: reference.display,
    createdAt: new Date(),
  };
  result.references.push(referenceRecord);
}

function processIdentifier(resourceType: string, resourceId: string, identifier: IFhirIdentifier, result: INormalizedFhirData): void {
  // We'll store identifiers in a generic way using the CodeableConcept table
  if (identifier.type) {
    processCodeableConcept(resourceType, resourceId, 'identifier.type', identifier.type, result);
  }

  // Store the identifier value in the references table as a special case
  const identifierRecord: IReferenceTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    fieldName: 'identifier',
    reference: identifier.value,
    type: identifier.use,
    identifier: JSON.stringify({
      system: identifier.system,
      value: identifier.value,
      period: identifier.period,
      assigner: identifier.assigner,
    }),
    display: `${identifier.system}|${identifier.value}`,
    createdAt: new Date(),
  };
  result.references.push(identifierRecord);
}

function processNote(resourceType: string, resourceId: string, note: IFhirAnnotation, result: INormalizedFhirData): void {
  const noteRecord: INoteTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    authorReference: note.authorReference?.reference,
    authorString: note.authorString,
    time: note.time,
    text: note.text,
    createdAt: new Date(),
  };
  result.notes.push(noteRecord);
}

function processAttachment(resourceType: string, resourceId: string, fieldName: string, attachment: IFhirAttachment, result: INormalizedFhirData): void {
  const attachmentRecord: IAttachmentTable = {
    id: uuidv4(),
    resourceType: resourceType,
    resourceId: resourceId,
    fieldName: fieldName,
    contentType: attachment.contentType,
    language: attachment.language,
    data: attachment.data,
    url: attachment.url,
    size: attachment.size,
    hash: attachment.hash,
    title: attachment.title,
    creation: attachment.creation,
    createdAt: new Date(),
  };
  result.attachments.push(attachmentRecord);
}

function processHumanName(resourceType: string, resourceId: string, name: IFhirHumanName, result: INormalizedFhirData): void {
  // Store human names in a generic way using the CodeableConcept table
  const nameText = name.text || `${name.prefix?.join(' ')} ${name.given?.join(' ')} ${name.family} ${name.suffix?.join(' ')}`.trim();
  processCodeableConcept(resourceType, resourceId, 'name', { text: nameText }, result);
}