import { ApiProperty } from '@nestjs/swagger';

export class UserIdDto {
  @ApiProperty({ type: 'string' })
  userId: string;
}
