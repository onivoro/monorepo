import { ApiProperty } from "@nestjs/swagger";

export class PasswordDto {
    @ApiProperty({ type: 'string' }) confirm: string;
    @ApiProperty({ type: 'string' }) password: string;
}