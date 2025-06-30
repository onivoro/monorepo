import { ApiPropertyOptional } from "@nestjs/swagger";

export class AccountUserDto {
    @ApiPropertyOptional({ type: 'string' }) email?: string;
    @ApiPropertyOptional({ type: 'string' }) firstName?: string;
    @ApiPropertyOptional({ type: 'string' }) lastName?: string;
    @ApiPropertyOptional({ type: 'string' }) phone?: string;
}
