import { ApiProperty } from "@nestjs/swagger"

export class CognitoSamlClientConfigDto {
    @ApiProperty({ type: 'string' }) authority: string;
    @ApiProperty({ type: 'string' }) client_id: string;
    @ApiProperty({ type: 'string' }) redirect_uri: string;
    @ApiProperty({ type: 'string' }) response_type: string;
    @ApiProperty({ type: 'string' }) scope: string;
}
