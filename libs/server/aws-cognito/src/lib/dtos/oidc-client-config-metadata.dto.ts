import { ApiProperty } from "@nestjs/swagger";

export class OidcClientConfigMetadataDto {
    @ApiProperty({ type: 'string' }) issuer: string;
    @ApiProperty({ type: 'string' }) authorization_endpoint: string;
    @ApiProperty({ type: 'string' }) token_endpoint: string;
    @ApiProperty({ type: 'string' }) userinfo_endpoint: string;
    @ApiProperty({ type: 'string' }) jwks_uri: string;
    @ApiProperty({ type: 'string' }) end_session_endpoint: string;
}