import { ApiProperty } from "@nestjs/swagger";

export class SuccessDto {
    @ApiProperty({ type: 'boolean' }) success: boolean;
}