import { ApiProperty } from '@nestjs/swagger';

export class RegistrationSignupDto {
  @ApiProperty({ type: 'string' }) email: string;
  @ApiProperty({ type: 'boolean' }) isAdmin: boolean;
  @ApiProperty({ type: 'string' }) orgId: string;
}
