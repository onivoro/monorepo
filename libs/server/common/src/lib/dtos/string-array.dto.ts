import { ApiProperty } from "@nestjs/swagger";

export class StringArrayDto {
    @ApiProperty({type: 'string', isArray: true})
    body: string[]
}
