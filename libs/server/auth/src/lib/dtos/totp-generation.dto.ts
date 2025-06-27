import { ApiProperty } from "@nestjs/swagger";

export class TotpGenerationDto {
    @ApiProperty({ type: 'string' }) url: string;
    @ApiProperty({ type: 'string' }) secret: string;
    @ApiProperty({ type: 'string' }) qr: string;
}
