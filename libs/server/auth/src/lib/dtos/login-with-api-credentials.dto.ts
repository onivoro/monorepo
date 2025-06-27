import { ApiProperty } from "@nestjs/swagger";

export class LoginWithApiCredentialsDto {
    @ApiProperty({ type: 'string' }) apiId: string;
    @ApiProperty({ type: 'string' }) apiKey: string;
}