import { ApiProperty } from '@nestjs/swagger';

export class McpServerInfoDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  version: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  author?: string;

  @ApiProperty({ required: false })
  homepage?: string;

  @ApiProperty()
  transport: string;

  @ApiProperty({ required: false })
  authentication?: {
    type: string;
    description: string;
    required: boolean;
  };

  @ApiProperty()
  requiredHeaders: Array<{
    name: string;
    description: string;
    example: string;
  }>;

  @ApiProperty()
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, string>;
  }>;

  @ApiProperty()
  architecture: string;
}

export class McpHealthDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  transport: string;

  @ApiProperty()
  timestamp: string;
}