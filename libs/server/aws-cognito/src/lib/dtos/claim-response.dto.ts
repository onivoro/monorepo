import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type IClaimResponse = {
  response: {
    claimsAndScopeOverrideDetails: {
      idTokenGeneration: {
        claimsToAddOrOverride: Record<string, any>,
        claimsToSuppress?: string[]
      },
      // accessTokenGeneration: {
      //   scopesToAdd: string[],
      //   scopesToSuppress: string[],
      // },
      // groupOverrideDetails: {
      //   groupsToOverride: string[],
      //   iamRolesToOverride: string[],
      //   preferredRole: string,
      // }
    }
  }
};

export class IdTokenGenerationDto {
  @ApiProperty({ type: 'object', properties: {} }) claimsToAddOrOverride: any;
  @ApiPropertyOptional({ type: 'string', isArray: true }) claimsToSuppress?: string[];
}

export class ClaimsAndScopeOverrideDetailsDto {
  @ApiProperty({ type: IdTokenGenerationDto }) idTokenGeneration: IdTokenGenerationDto;
}

export class ClaimResponseDto {
  @ApiProperty({ type: ClaimsAndScopeOverrideDetailsDto }) claimsAndScopeOverrideDetails: ClaimsAndScopeOverrideDetailsDto;
}

export class ClaimDto implements IClaimResponse {
  @ApiProperty({ type: ClaimResponseDto }) response: ClaimResponseDto;
};