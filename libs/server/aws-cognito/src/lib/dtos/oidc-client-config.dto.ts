import { ApiProperty } from "@nestjs/swagger";
import { OidcClientConfigMetadataDto } from "./oidc-client-config-metadata.dto";

export class OidcClientConfigDto {
    @ApiProperty({ type: 'string' }) oidcUser: string;
    @ApiProperty({ type: 'string' }) authority: string;
    @ApiProperty({ type: 'string' }) client_id: string;
    @ApiProperty({ type: 'string' }) redirect_uri: string;
    @ApiProperty({ type: 'string' }) response_type: string;
    @ApiProperty({ type: 'string' }) scope: string;
    @ApiProperty({ type: OidcClientConfigMetadataDto }) metadata: OidcClientConfigMetadataDto;
}
