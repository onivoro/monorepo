import { ApiProperty } from "@nestjs/swagger";

export class EmailDto {
    @ApiProperty({ type: 'string' }) email: string;
}