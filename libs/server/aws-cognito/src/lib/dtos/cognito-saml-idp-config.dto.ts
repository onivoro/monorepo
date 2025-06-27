import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CognitoSamlIdpConfigDto {
    @ApiProperty({ type: 'string' }) entityIdentifier: string;
    @ApiProperty({ type: 'string' }) replyUrl: string;
    @ApiPropertyOptional({ type: 'string' }) signOnUrl?: string;
    @ApiProperty({ type: 'string' }) relayState: string;
    @ApiPropertyOptional({ type: 'string' }) logoutUrl?: string;
}