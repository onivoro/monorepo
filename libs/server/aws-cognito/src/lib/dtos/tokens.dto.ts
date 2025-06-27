import { ApiProperty } from "@nestjs/swagger";

export class TokensDto {
    @ApiProperty({ type: 'string' }) id_token: string;
    @ApiProperty({ type: 'string' }) refresh_token: string;
    @ApiProperty({ type: 'string' }) access_token: string;
}