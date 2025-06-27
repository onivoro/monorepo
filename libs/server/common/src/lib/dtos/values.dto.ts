import { ApiProperty } from "@nestjs/swagger";

export class ValuesDto {
    @ApiProperty({type: 'string', isArray: true})
    values: string[]
}
