import { ApiProperty } from "@nestjs/swagger";

export class LoginWithEmailAndPasswordDto {
    @ApiProperty({ type: 'string' }) email: string;
    @ApiProperty({ type: 'string' }) password: string;
}