import { ApiProperty } from "@nestjs/swagger";

export class AuthTokensDto {
    @ApiProperty({ type: 'string' }) token: string;
    @ApiProperty({ type: 'string' }) idToken: string;
}
