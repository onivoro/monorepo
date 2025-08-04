// FHIR R4 Resource Interfaces
// Based on HL7 FHIR (Fast Healthcare Interoperability Resources) standard

export interface IFhirBundle {
  resourceType: 'Bundle';
  id?: string;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  entry?: IFhirBundleEntry[];
}

export interface IFhirBundleEntry {
  fullUrl?: string;
  resource?: IFhirResource;
  search?: {
    mode?: 'match' | 'include' | 'outcome';
    score?: number;
  };
}

export type IFhirResource = 
  | IFhirPatient
  | IFhirPractitioner
  | IFhirOrganization
  | IFhirEncounter
  | IFhirCondition
  | IFhirObservation
  | IFhirMedicationRequest
  | IFhirProcedure
  | IFhirImmunization
  | IFhirAllergyIntolerance
  | IFhirDiagnosticReport
  | IFhirLocation
  | IFhirAppointment
  | IFhirCareTeam
  | IFhirCarePlan;

export interface IFhirPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: IFhirIdentifier[];
  active?: boolean;
  name?: IFhirHumanName[];
  telecom?: IFhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceased?: boolean | string;
  address?: IFhirAddress[];
  maritalStatus?: IFhirCodeableConcept;
  multipleBirth?: boolean | number;
  photo?: IFhirAttachment[];
  contact?: IFhirPatientContact[];
  communication?: IFhirPatientCommunication[];
  generalPractitioner?: IFhirReference[];
  managingOrganization?: IFhirReference;
}

export interface IFhirPractitioner {
  resourceType: 'Practitioner';
  id?: string;
  identifier?: IFhirIdentifier[];
  active?: boolean;
  name?: IFhirHumanName[];
  telecom?: IFhirContactPoint[];
  address?: IFhirAddress[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: IFhirAttachment[];
  qualification?: IFhirPractitionerQualification[];
  communication?: IFhirCodeableConcept[];
}

export interface IFhirOrganization {
  resourceType: 'Organization';
  id?: string;
  identifier?: IFhirIdentifier[];
  active?: boolean;
  type?: IFhirCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: IFhirContactPoint[];
  address?: IFhirAddress[];
  partOf?: IFhirReference;
  contact?: IFhirOrganizationContact[];
  endpoint?: IFhirReference[];
}

export interface IFhirEncounter {
  resourceType: 'Encounter';
  id?: string;
  identifier?: IFhirIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: IFhirEncounterStatusHistory[];
  class: IFhirCoding;
  classHistory?: IFhirEncounterClassHistory[];
  type?: IFhirCodeableConcept[];
  serviceType?: IFhirCodeableConcept;
  priority?: IFhirCodeableConcept;
  subject?: IFhirReference;
  episodeOfCare?: IFhirReference[];
  basedOn?: IFhirReference[];
  participant?: IFhirEncounterParticipant[];
  appointment?: IFhirReference[];
  period?: IFhirPeriod;
  length?: IFhirDuration;
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  diagnosis?: IFhirEncounterDiagnosis[];
  account?: IFhirReference[];
  hospitalization?: IFhirEncounterHospitalization;
  location?: IFhirEncounterLocation[];
  serviceProvider?: IFhirReference;
  partOf?: IFhirReference;
}

export interface IFhirCondition {
  resourceType: 'Condition';
  id?: string;
  identifier?: IFhirIdentifier[];
  clinicalStatus?: IFhirCodeableConcept;
  verificationStatus?: IFhirCodeableConcept;
  category?: IFhirCodeableConcept[];
  severity?: IFhirCodeableConcept;
  code?: IFhirCodeableConcept;
  bodySite?: IFhirCodeableConcept[];
  subject: IFhirReference;
  encounter?: IFhirReference;
  onset?: string | IFhirAge | IFhirPeriod | IFhirRange;
  abatement?: string | IFhirAge | IFhirPeriod | IFhirRange;
  recordedDate?: string;
  recorder?: IFhirReference;
  asserter?: IFhirReference;
  stage?: IFhirConditionStage[];
  evidence?: IFhirConditionEvidence[];
  note?: IFhirAnnotation[];
}

export interface IFhirObservation {
  resourceType: 'Observation';
  id?: string;
  identifier?: IFhirIdentifier[];
  basedOn?: IFhirReference[];
  partOf?: IFhirReference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: IFhirCodeableConcept[];
  code: IFhirCodeableConcept;
  subject?: IFhirReference;
  focus?: IFhirReference[];
  encounter?: IFhirReference;
  effective?: string | IFhirPeriod;
  issued?: string;
  performer?: IFhirReference[];
  value?: any; // Can be various types
  dataAbsentReason?: IFhirCodeableConcept;
  interpretation?: IFhirCodeableConcept[];
  note?: IFhirAnnotation[];
  bodySite?: IFhirCodeableConcept;
  method?: IFhirCodeableConcept;
  specimen?: IFhirReference;
  device?: IFhirReference;
  referenceRange?: IFhirObservationReferenceRange[];
  hasMember?: IFhirReference[];
  derivedFrom?: IFhirReference[];
  component?: IFhirObservationComponent[];
}

export interface IFhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  identifier?: IFhirIdentifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: IFhirCodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'instance-order' | 'option';
  category?: IFhirCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reported?: boolean | IFhirReference;
  medication?: IFhirCodeableConcept | IFhirReference;
  subject: IFhirReference;
  encounter?: IFhirReference;
  supportingInformation?: IFhirReference[];
  authoredOn?: string;
  requester?: IFhirReference;
  performer?: IFhirReference;
  performerType?: IFhirCodeableConcept;
  recorder?: IFhirReference;
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: IFhirReference[];
  groupIdentifier?: IFhirIdentifier;
  courseOfTherapyType?: IFhirCodeableConcept;
  insurance?: IFhirReference[];
  note?: IFhirAnnotation[];
  dosageInstruction?: IFhirDosage[];
  dispenseRequest?: IFhirMedicationRequestDispenseRequest;
  substitution?: IFhirMedicationRequestSubstitution;
  priorPrescription?: IFhirReference;
  detectedIssue?: IFhirReference[];
  eventHistory?: IFhirReference[];
}

export interface IFhirProcedure {
  resourceType: 'Procedure';
  id?: string;
  identifier?: IFhirIdentifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: IFhirReference[];
  partOf?: IFhirReference[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: IFhirCodeableConcept;
  category?: IFhirCodeableConcept;
  code?: IFhirCodeableConcept;
  subject: IFhirReference;
  encounter?: IFhirReference;
  performed?: string | IFhirPeriod | IFhirAge | IFhirRange;
  recorder?: IFhirReference;
  asserter?: IFhirReference;
  performer?: IFhirProcedurePerformer[];
  location?: IFhirReference;
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  bodySite?: IFhirCodeableConcept[];
  outcome?: IFhirCodeableConcept;
  report?: IFhirReference[];
  complication?: IFhirCodeableConcept[];
  complicationDetail?: IFhirReference[];
  followUp?: IFhirCodeableConcept[];
  note?: IFhirAnnotation[];
  focalDevice?: IFhirProcedureFocalDevice[];
  usedReference?: IFhirReference[];
  usedCode?: IFhirCodeableConcept[];
}

export interface IFhirImmunization {
  resourceType: 'Immunization';
  id?: string;
  identifier?: IFhirIdentifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: IFhirCodeableConcept;
  vaccineCode: IFhirCodeableConcept;
  patient: IFhirReference;
  encounter?: IFhirReference;
  occurrence?: string | IFhirDateTime;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: IFhirCodeableConcept;
  location?: IFhirReference;
  manufacturer?: IFhirReference;
  lotNumber?: string;
  expirationDate?: string;
  site?: IFhirCodeableConcept;
  route?: IFhirCodeableConcept;
  doseQuantity?: IFhirQuantity;
  performer?: IFhirImmunizationPerformer[];
  note?: IFhirAnnotation[];
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  isSubpotent?: boolean;
  subpotentReason?: IFhirCodeableConcept[];
  education?: IFhirImmunizationEducation[];
  programEligibility?: IFhirCodeableConcept[];
  fundingSource?: IFhirCodeableConcept;
  reaction?: IFhirImmunizationReaction[];
  protocolApplied?: IFhirImmunizationProtocolApplied[];
}

export interface IFhirAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  identifier?: IFhirIdentifier[];
  clinicalStatus?: IFhirCodeableConcept;
  verificationStatus?: IFhirCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: IFhirCodeableConcept;
  patient: IFhirReference;
  encounter?: IFhirReference;
  onset?: string | IFhirAge | IFhirPeriod | IFhirRange;
  recordedDate?: string;
  recorder?: IFhirReference;
  asserter?: IFhirReference;
  lastOccurrence?: string;
  note?: IFhirAnnotation[];
  reaction?: IFhirAllergyIntoleranceReaction[];
}

export interface IFhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  identifier?: IFhirIdentifier[];
  basedOn?: IFhirReference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: IFhirCodeableConcept[];
  code: IFhirCodeableConcept;
  subject?: IFhirReference;
  encounter?: IFhirReference;
  effective?: string | IFhirPeriod;
  issued?: string;
  performer?: IFhirReference[];
  resultsInterpreter?: IFhirReference[];
  specimen?: IFhirReference[];
  result?: IFhirReference[];
  imagingStudy?: IFhirReference[];
  media?: IFhirDiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: IFhirCodeableConcept[];
  presentedForm?: IFhirAttachment[];
}

export interface IFhirLocation {
  resourceType: 'Location';
  id?: string;
  identifier?: IFhirIdentifier[];
  status?: 'active' | 'suspended' | 'inactive';
  operationalStatus?: IFhirCoding;
  name?: string;
  alias?: string[];
  description?: string;
  mode?: 'instance' | 'kind';
  type?: IFhirCodeableConcept[];
  telecom?: IFhirContactPoint[];
  address?: IFhirAddress;
  physicalType?: IFhirCodeableConcept;
  position?: IFhirLocationPosition;
  managingOrganization?: IFhirReference;
  partOf?: IFhirReference;
  hoursOfOperation?: IFhirLocationHoursOfOperation[];
  availabilityExceptions?: string;
  endpoint?: IFhirReference[];
}

export interface IFhirAppointment {
  resourceType: 'Appointment';
  id?: string;
  identifier?: IFhirIdentifier[];
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
  cancelationReason?: IFhirCodeableConcept;
  serviceCategory?: IFhirCodeableConcept[];
  serviceType?: IFhirCodeableConcept[];
  specialty?: IFhirCodeableConcept[];
  appointmentType?: IFhirCodeableConcept;
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  priority?: number;
  description?: string;
  supportingInformation?: IFhirReference[];
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: IFhirReference[];
  created?: string;
  comment?: string;
  patientInstruction?: string;
  basedOn?: IFhirReference[];
  participant: IFhirAppointmentParticipant[];
  requestedPeriod?: IFhirPeriod[];
}

export interface IFhirCareTeam {
  resourceType: 'CareTeam';
  id?: string;
  identifier?: IFhirIdentifier[];
  status?: 'proposed' | 'active' | 'suspended' | 'inactive' | 'entered-in-error';
  category?: IFhirCodeableConcept[];
  name?: string;
  subject?: IFhirReference;
  encounter?: IFhirReference;
  period?: IFhirPeriod;
  participant?: IFhirCareTeamParticipant[];
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  managingOrganization?: IFhirReference[];
  telecom?: IFhirContactPoint[];
  note?: IFhirAnnotation[];
}

export interface IFhirCarePlan {
  resourceType: 'CarePlan';
  id?: string;
  identifier?: IFhirIdentifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: IFhirReference[];
  replaces?: IFhirReference[];
  partOf?: IFhirReference[];
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'option';
  category?: IFhirCodeableConcept[];
  title?: string;
  description?: string;
  subject: IFhirReference;
  encounter?: IFhirReference;
  period?: IFhirPeriod;
  created?: string;
  author?: IFhirReference;
  contributor?: IFhirReference[];
  careTeam?: IFhirReference[];
  addresses?: IFhirReference[];
  supportingInfo?: IFhirReference[];
  goal?: IFhirReference[];
  activity?: IFhirCarePlanActivity[];
  note?: IFhirAnnotation[];
}

// Common FHIR datatypes
export interface IFhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: IFhirCodeableConcept;
  system?: string;
  value?: string;
  period?: IFhirPeriod;
  assigner?: IFhirReference;
}

export interface IFhirHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: IFhirPeriod;
}

export interface IFhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: IFhirPeriod;
}

export interface IFhirAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: IFhirPeriod;
}

export interface IFhirCodeableConcept {
  coding?: IFhirCoding[];
  text?: string;
}

export interface IFhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface IFhirReference {
  reference?: string;
  type?: string;
  identifier?: IFhirIdentifier;
  display?: string;
}

export interface IFhirPeriod {
  start?: string;
  end?: string;
}

export interface IFhirQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface IFhirRange {
  low?: IFhirQuantity;
  high?: IFhirQuantity;
}

export interface IFhirAge {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface IFhirAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface IFhirAnnotation {
  authorReference?: IFhirReference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface IFhirDuration {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface IFhirDateTime {
  dateTime?: string;
}

export interface IFhirDosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: IFhirCodeableConcept[];
  patientInstruction?: string;
  timing?: IFhirTiming;
  asNeeded?: boolean | IFhirCodeableConcept;
  site?: IFhirCodeableConcept;
  route?: IFhirCodeableConcept;
  method?: IFhirCodeableConcept;
  doseAndRate?: IFhirDosageDoseAndRate[];
  maxDosePerPeriod?: IFhirRatio;
  maxDosePerAdministration?: IFhirQuantity;
  maxDosePerLifetime?: IFhirQuantity;
}

export interface IFhirTiming {
  event?: string[];
  repeat?: IFhirTimingRepeat;
  code?: IFhirCodeableConcept;
}

export interface IFhirTimingRepeat {
  bounds?: IFhirDuration | IFhirRange | IFhirPeriod;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: string;
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: string;
  dayOfWeek?: string[];
  timeOfDay?: string[];
  when?: string[];
  offset?: number;
}

export interface IFhirRatio {
  numerator?: IFhirQuantity;
  denominator?: IFhirQuantity;
}

export interface IFhirDosageDoseAndRate {
  type?: IFhirCodeableConcept;
  dose?: IFhirRange | IFhirQuantity;
  rate?: IFhirRatio | IFhirRange | IFhirQuantity;
}

// Additional interfaces for complex sub-resources
export interface IFhirPatientContact {
  relationship?: IFhirCodeableConcept[];
  name?: IFhirHumanName;
  telecom?: IFhirContactPoint[];
  address?: IFhirAddress;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: IFhirReference;
  period?: IFhirPeriod;
}

export interface IFhirPatientCommunication {
  language: IFhirCodeableConcept;
  preferred?: boolean;
}

export interface IFhirPractitionerQualification {
  identifier?: IFhirIdentifier[];
  code: IFhirCodeableConcept;
  period?: IFhirPeriod;
  issuer?: IFhirReference;
}

export interface IFhirOrganizationContact {
  purpose?: IFhirCodeableConcept;
  name?: IFhirHumanName;
  telecom?: IFhirContactPoint[];
  address?: IFhirAddress;
}

export interface IFhirEncounterStatusHistory {
  status: string;
  period: IFhirPeriod;
}

export interface IFhirEncounterClassHistory {
  class: IFhirCoding;
  period: IFhirPeriod;
}

export interface IFhirEncounterParticipant {
  type?: IFhirCodeableConcept[];
  period?: IFhirPeriod;
  individual?: IFhirReference;
}

export interface IFhirEncounterDiagnosis {
  condition: IFhirReference;
  use?: IFhirCodeableConcept;
  rank?: number;
}

export interface IFhirEncounterHospitalization {
  preAdmissionIdentifier?: IFhirIdentifier;
  origin?: IFhirReference;
  admitSource?: IFhirCodeableConcept;
  reAdmission?: IFhirCodeableConcept;
  dietPreference?: IFhirCodeableConcept[];
  specialCourtesy?: IFhirCodeableConcept[];
  specialArrangement?: IFhirCodeableConcept[];
  destination?: IFhirReference;
  dischargeDisposition?: IFhirCodeableConcept;
}

export interface IFhirEncounterLocation {
  location: IFhirReference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: IFhirCodeableConcept;
  period?: IFhirPeriod;
}

export interface IFhirConditionStage {
  summary?: IFhirCodeableConcept;
  assessment?: IFhirReference[];
  type?: IFhirCodeableConcept;
}

export interface IFhirConditionEvidence {
  code?: IFhirCodeableConcept[];
  detail?: IFhirReference[];
}

export interface IFhirObservationReferenceRange {
  low?: IFhirQuantity;
  high?: IFhirQuantity;
  type?: IFhirCodeableConcept;
  appliesTo?: IFhirCodeableConcept[];
  age?: IFhirRange;
  text?: string;
}

export interface IFhirObservationComponent {
  code: IFhirCodeableConcept;
  value?: any;
  dataAbsentReason?: IFhirCodeableConcept;
  interpretation?: IFhirCodeableConcept[];
  referenceRange?: IFhirObservationReferenceRange[];
}

export interface IFhirMedicationRequestDispenseRequest {
  initialFill?: IFhirMedicationRequestInitialFill;
  dispenseInterval?: IFhirDuration;
  validityPeriod?: IFhirPeriod;
  numberOfRepeatsAllowed?: number;
  quantity?: IFhirQuantity;
  expectedSupplyDuration?: IFhirDuration;
  performer?: IFhirReference;
}

export interface IFhirMedicationRequestInitialFill {
  quantity?: IFhirQuantity;
  duration?: IFhirDuration;
}

export interface IFhirMedicationRequestSubstitution {
  allowed?: boolean | IFhirCodeableConcept;
  reason?: IFhirCodeableConcept;
}

export interface IFhirProcedurePerformer {
  function?: IFhirCodeableConcept;
  actor: IFhirReference;
  onBehalfOf?: IFhirReference;
}

export interface IFhirProcedureFocalDevice {
  action?: IFhirCodeableConcept;
  manipulated: IFhirReference;
}

export interface IFhirImmunizationPerformer {
  function?: IFhirCodeableConcept;
  actor: IFhirReference;
}

export interface IFhirImmunizationEducation {
  documentType?: string;
  reference?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface IFhirImmunizationReaction {
  date?: string;
  detail?: IFhirReference;
  reported?: boolean;
}

export interface IFhirImmunizationProtocolApplied {
  series?: string;
  authority?: IFhirReference;
  targetDisease?: IFhirCodeableConcept[];
  doseNumber?: number | string;
  seriesDoses?: number | string;
}

export interface IFhirAllergyIntoleranceReaction {
  substance?: IFhirCodeableConcept;
  manifestation: IFhirCodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: IFhirCodeableConcept;
  note?: IFhirAnnotation[];
}

export interface IFhirDiagnosticReportMedia {
  comment?: string;
  link: IFhirReference;
}

export interface IFhirLocationPosition {
  longitude: number;
  latitude: number;
  altitude?: number;
}

export interface IFhirLocationHoursOfOperation {
  daysOfWeek?: string[];
  allDay?: boolean;
  openingTime?: string;
  closingTime?: string;
}

export interface IFhirAppointmentParticipant {
  type?: IFhirCodeableConcept[];
  actor?: IFhirReference;
  required?: 'required' | 'optional' | 'information-only';
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  period?: IFhirPeriod;
}

export interface IFhirCareTeamParticipant {
  role?: IFhirCodeableConcept[];
  member?: IFhirReference;
  onBehalfOf?: IFhirReference;
  period?: IFhirPeriod;
}

export interface IFhirCarePlanActivity {
  outcomeCodeableConcept?: IFhirCodeableConcept[];
  outcomeReference?: IFhirReference[];
  progress?: IFhirAnnotation[];
  reference?: IFhirReference;
  detail?: IFhirCarePlanActivityDetail;
}

export interface IFhirCarePlanActivityDetail {
  kind?: 'Appointment' | 'CommunicationRequest' | 'DeviceRequest' | 'MedicationRequest' | 'NutritionOrder' | 'Task' | 'ServiceRequest' | 'VisionPrescription';
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  code?: IFhirCodeableConcept;
  reasonCode?: IFhirCodeableConcept[];
  reasonReference?: IFhirReference[];
  goal?: IFhirReference[];
  status: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';
  statusReason?: IFhirCodeableConcept;
  doNotPerform?: boolean;
  scheduled?: string | IFhirTiming | IFhirPeriod;
  location?: IFhirReference;
  performer?: IFhirReference[];
  product?: IFhirCodeableConcept | IFhirReference;
  dailyAmount?: IFhirQuantity;
  quantity?: IFhirQuantity;
  description?: string;
}