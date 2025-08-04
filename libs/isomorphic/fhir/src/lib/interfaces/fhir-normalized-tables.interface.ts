// Normalized FHIR tables following Third Normal Form (3NF)

export interface IPatientTable {
  id: string;
  resourceId?: string;
  active?: boolean;
  gender?: string;
  birthDate?: string;
  deceased?: boolean;
  deceasedDateTime?: string;
  maritalStatus?: string;
  multipleBirth?: boolean;
  multipleBirthInteger?: number;
  managingOrganizationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPatientIdentifierTable {
  id: string;
  patientId: string;
  use?: string;
  system?: string;
  value?: string;
  periodStart?: string;
  periodEnd?: string;
  assignerReference?: string;
  createdAt?: Date;
}

export interface IPatientNameTable {
  id: string;
  patientId: string;
  use?: string;
  text?: string;
  family?: string;
  given?: string;
  prefix?: string;
  suffix?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface IPatientContactTable {
  id: string;
  patientId: string;
  relationshipCode?: string;
  relationshipText?: string;
  name?: string;
  gender?: string;
  organizationReference?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface IPractitionerTable {
  id: string;
  resourceId?: string;
  active?: boolean;
  gender?: string;
  birthDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPractitionerQualificationTable {
  id: string;
  practitionerId: string;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  periodStart?: string;
  periodEnd?: string;
  issuerReference?: string;
  createdAt?: Date;
}

export interface IOrganizationTable {
  id: string;
  resourceId?: string;
  active?: boolean;
  name?: string;
  partOfReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrganizationTypeTable {
  id: string;
  organizationId: string;
  system?: string;
  code?: string;
  display?: string;
  createdAt?: Date;
}

export interface ILocationTable {
  id: string;
  resourceId?: string;
  status?: string;
  operationalStatus?: string;
  name?: string;
  description?: string;
  mode?: string;
  physicalType?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  managingOrganizationReference?: string;
  partOfReference?: string;
  availabilityExceptions?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEncounterTable {
  id: string;
  resourceId?: string;
  status: string;
  class: string;
  classSystem?: string;
  classDisplay?: string;
  serviceType?: string;
  priority?: string;
  subjectReference?: string;
  episodeOfCareReference?: string;
  serviceProviderReference?: string;
  partOfReference?: string;
  periodStart?: string;
  periodEnd?: string;
  lengthValue?: number;
  lengthUnit?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEncounterParticipantTable {
  id: string;
  encounterId: string;
  typeCode?: string;
  typeDisplay?: string;
  individualReference?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface IConditionTable {
  id: string;
  resourceId?: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  severity?: string;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  subjectReference: string;
  encounterReference?: string;
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorderReference?: string;
  asserterReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IObservationTable {
  id: string;
  resourceId?: string;
  status: string;
  code: string;
  codeSystem?: string;
  codeDisplay?: string;
  subjectReference?: string;
  encounterReference?: string;
  effectiveDateTime?: string;
  effectivePeriodStart?: string;
  effectivePeriodEnd?: string;
  issued?: string;
  valueType?: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDateTime?: string;
  valueCodeableConcept?: string;
  dataAbsentReason?: string;
  bodySite?: string;
  method?: string;
  specimenReference?: string;
  deviceReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IObservationComponentTable {
  id: string;
  observationId: string;
  code: string;
  codeSystem?: string;
  codeDisplay?: string;
  valueType?: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDateTime?: string;
  dataAbsentReason?: string;
  createdAt?: Date;
}

export interface IMedicationRequestTable {
  id: string;
  resourceId?: string;
  status: string;
  statusReason?: string;
  intent: string;
  priority?: string;
  doNotPerform?: boolean;
  medicationCodeableConcept?: string;
  medicationReference?: string;
  subjectReference: string;
  encounterReference?: string;
  authoredOn?: string;
  requesterReference?: string;
  performerReference?: string;
  performerType?: string;
  recorderReference?: string;
  groupIdentifierValue?: string;
  courseOfTherapyType?: string;
  priorPrescriptionReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMedicationDosageTable {
  id: string;
  medicationRequestId: string;
  sequence?: number;
  text?: string;
  patientInstruction?: string;
  asNeeded?: boolean;
  asNeededCode?: string;
  site?: string;
  route?: string;
  method?: string;
  doseValue?: number;
  doseUnit?: string;
  doseCode?: string;
  rateValue?: number;
  rateUnit?: string;
  maxDosePerPeriodValue?: number;
  maxDosePerPeriodUnit?: string;
  createdAt?: Date;
}

export interface IProcedureTable {
  id: string;
  resourceId?: string;
  status: string;
  statusReason?: string;
  category?: string;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  subjectReference: string;
  encounterReference?: string;
  performedDateTime?: string;
  performedPeriodStart?: string;
  performedPeriodEnd?: string;
  recorderReference?: string;
  asserterReference?: string;
  locationReference?: string;
  outcome?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProcedurePerformerTable {
  id: string;
  procedureId: string;
  function?: string;
  actorReference: string;
  onBehalfOfReference?: string;
  createdAt?: Date;
}

export interface IImmunizationTable {
  id: string;
  resourceId?: string;
  status: string;
  statusReason?: string;
  vaccineCode: string;
  vaccineCodeSystem?: string;
  vaccineCodeDisplay?: string;
  patientReference: string;
  encounterReference?: string;
  occurrenceDateTime?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: string;
  locationReference?: string;
  manufacturerReference?: string;
  lotNumber?: string;
  expirationDate?: string;
  site?: string;
  route?: string;
  doseQuantityValue?: number;
  doseQuantityUnit?: string;
  isSubpotent?: boolean;
  fundingSource?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAllergyIntoleranceTable {
  id: string;
  resourceId?: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  type?: string;
  criticality?: string;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  patientReference: string;
  encounterReference?: string;
  onsetDateTime?: string;
  recordedDate?: string;
  recorderReference?: string;
  asserterReference?: string;
  lastOccurrence?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAllergyReactionTable {
  id: string;
  allergyIntoleranceId: string;
  substance?: string;
  description?: string;
  onset?: string;
  severity?: string;
  exposureRoute?: string;
  createdAt?: Date;
}

export interface IAllergyManifestationTable {
  id: string;
  allergyReactionId: string;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  createdAt?: Date;
}

export interface IDiagnosticReportTable {
  id: string;
  resourceId?: string;
  status: string;
  code: string;
  codeSystem?: string;
  codeDisplay?: string;
  subjectReference?: string;
  encounterReference?: string;
  effectiveDateTime?: string;
  effectivePeriodStart?: string;
  effectivePeriodEnd?: string;
  issued?: string;
  conclusion?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDiagnosticReportResultTable {
  id: string;
  diagnosticReportId: string;
  resultReference: string;
  createdAt?: Date;
}

export interface IAppointmentTable {
  id: string;
  resourceId?: string;
  status: string;
  cancelationReason?: string;
  serviceCategory?: string;
  serviceType?: string;
  specialty?: string;
  appointmentType?: string;
  priority?: number;
  description?: string;
  start?: string;
  end?: string;
  minutesDuration?: number;
  created?: string;
  comment?: string;
  patientInstruction?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAppointmentParticipantTable {
  id: string;
  appointmentId: string;
  type?: string;
  actorReference?: string;
  required?: string;
  status: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface ICareTeamTable {
  id: string;
  resourceId?: string;
  status?: string;
  name?: string;
  subjectReference?: string;
  encounterReference?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICareTeamParticipantTable {
  id: string;
  careTeamId: string;
  role?: string;
  memberReference?: string;
  onBehalfOfReference?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface ICarePlanTable {
  id: string;
  resourceId?: string;
  status: string;
  intent: string;
  title?: string;
  description?: string;
  subjectReference: string;
  encounterReference?: string;
  periodStart?: string;
  periodEnd?: string;
  created?: string;
  authorReference?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICarePlanActivityTable {
  id: string;
  carePlanId: string;
  outcomeCodeableConcept?: string;
  outcomeReference?: string;
  progress?: string;
  reference?: string;
  kind?: string;
  code?: string;
  status: string;
  statusReason?: string;
  doNotPerform?: boolean;
  scheduledDateTime?: string;
  scheduledPeriodStart?: string;
  scheduledPeriodEnd?: string;
  locationReference?: string;
  performerReference?: string;
  productCodeableConcept?: string;
  productReference?: string;
  dailyAmountValue?: number;
  dailyAmountUnit?: string;
  quantityValue?: number;
  quantityUnit?: string;
  description?: string;
  createdAt?: Date;
}

export interface IAddressTable {
  id: string;
  resourceType: string;
  resourceId: string;
  use?: string;
  type?: string;
  text?: string;
  line?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITelecomTable {
  id: string;
  resourceType: string;
  resourceId: string;
  system?: string;
  value?: string;
  use?: string;
  rank?: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: Date;
}

export interface ICodeableConceptTable {
  id: string;
  resourceType: string;
  resourceId: string;
  fieldName: string;
  text?: string;
  createdAt?: Date;
}

export interface ICodingTable {
  id: string;
  codeableConceptId: string;
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
  createdAt?: Date;
}

export interface INoteTable {
  id: string;
  resourceType: string;
  resourceId: string;
  authorReference?: string;
  authorString?: string;
  time?: string;
  text: string;
  createdAt?: Date;
}

export interface IAttachmentTable {
  id: string;
  resourceType: string;
  resourceId: string;
  fieldName: string;
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
  createdAt?: Date;
}

export interface IReferenceTable {
  id: string;
  resourceType: string;
  resourceId: string;
  fieldName: string;
  reference?: string;
  type?: string;
  identifier?: string;
  display?: string;
  createdAt?: Date;
}

export interface IBundleTable {
  id: string;
  resourceId?: string;
  type: string;
  timestamp?: string;
  total?: number;
  createdAt?: Date;
}

export interface IBundleEntryTable {
  id: string;
  bundleId: string;
  fullUrl?: string;
  resourceType?: string;
  resourceId?: string;
  searchMode?: string;
  searchScore?: number;
  createdAt?: Date;
}

// Result of FHIR normalization process
export interface INormalizedFhirData {
  bundles: IBundleTable[];
  bundleEntries: IBundleEntryTable[];
  patients: IPatientTable[];
  patientIdentifiers: IPatientIdentifierTable[];
  patientNames: IPatientNameTable[];
  patientContacts: IPatientContactTable[];
  practitioners: IPractitionerTable[];
  practitionerQualifications: IPractitionerQualificationTable[];
  organizations: IOrganizationTable[];
  organizationTypes: IOrganizationTypeTable[];
  locations: ILocationTable[];
  encounters: IEncounterTable[];
  encounterParticipants: IEncounterParticipantTable[];
  conditions: IConditionTable[];
  observations: IObservationTable[];
  observationComponents: IObservationComponentTable[];
  medicationRequests: IMedicationRequestTable[];
  medicationDosages: IMedicationDosageTable[];
  procedures: IProcedureTable[];
  procedurePerformers: IProcedurePerformerTable[];
  immunizations: IImmunizationTable[];
  allergyIntolerances: IAllergyIntoleranceTable[];
  allergyReactions: IAllergyReactionTable[];
  allergyManifestations: IAllergyManifestationTable[];
  diagnosticReports: IDiagnosticReportTable[];
  diagnosticReportResults: IDiagnosticReportResultTable[];
  appointments: IAppointmentTable[];
  appointmentParticipants: IAppointmentParticipantTable[];
  careTeams: ICareTeamTable[];
  careTeamParticipants: ICareTeamParticipantTable[];
  carePlans: ICarePlanTable[];
  carePlanActivities: ICarePlanActivityTable[];
  addresses: IAddressTable[];
  telecoms: ITelecomTable[];
  codeableConcepts: ICodeableConceptTable[];
  codings: ICodingTable[];
  notes: INoteTable[];
  attachments: IAttachmentTable[];
  references: IReferenceTable[];
}