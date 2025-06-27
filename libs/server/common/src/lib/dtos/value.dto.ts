import { ApiProperty } from '@nestjs/swagger';

export class ValueDto {
  @ApiProperty({ type: 'string' })
  value: string;
}
