export interface IPreTokenGenerationEvent {
    userName: string;
    request: {},
    response: {
        claimsOverrideDetails: {
            claimsToAddOrOverride: Record<string, any>
        }
    }
}
