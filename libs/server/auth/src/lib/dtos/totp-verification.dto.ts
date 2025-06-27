import { ApiProperty } from "@nestjs/swagger";

export class TotpVerificationDto {
    @ApiProperty({ type: 'string' }) token: string;
    @ApiProperty({ type: 'string' }) secret: string;
}
