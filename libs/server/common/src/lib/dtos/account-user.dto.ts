import { User } from "@onivoro/server-b2b-orm";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class AccountUserDto {
    @ApiPropertyOptional({ type: 'string' }) email?: User['email'];
    @ApiPropertyOptional({ type: 'string' }) firstName?: User['firstName'];
    @ApiPropertyOptional({ type: 'string' }) lastName?: User['lastName'];
    @ApiPropertyOptional({ type: 'string' }) phone?: User['phone'];
}
