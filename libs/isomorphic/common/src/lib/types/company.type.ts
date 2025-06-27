import { Company } from "@onivoro/axios/b2b";

export type TCompany = Pick<Company, 'id' | 'statusId' | 'renewalDate' | 'name' | 'ein' | 'duns' | 'address1' | 'address2' | 'city' | 'state' | 'zip' | 'phone' | 'externalId' | 'bmiThresholdWithComorbidities' | 'bmiThresholdWithoutComorbidities'
    | 'membershipType' >;
