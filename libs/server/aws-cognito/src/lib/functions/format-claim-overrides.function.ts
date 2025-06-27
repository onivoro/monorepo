import { ClaimDto } from "../dtos/claim-response.dto";

export function formatIdentityTokenClaimObject(
    claimsToAddOrOverride: Record<any, any>,
): ClaimDto {
    return {
        response: {
            claimsAndScopeOverrideDetails: {
                idTokenGeneration: {
                    claimsToAddOrOverride
                }
            }
        }
    };
}