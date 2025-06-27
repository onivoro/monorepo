import { ApiProperty } from "@nestjs/swagger";

export class BodyDto {
    @ApiProperty({ type: 'string' })
    body: string;
}
