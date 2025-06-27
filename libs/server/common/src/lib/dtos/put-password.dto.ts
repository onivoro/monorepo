import { ApiProperty } from "@nestjs/swagger";

export class PutPasswordDto {
    @ApiProperty({ type: 'string' }) current: string;
    @ApiProperty({ type: 'string' }) updated: string;
    @ApiProperty({ type: 'string' }) confirmed: string;
}