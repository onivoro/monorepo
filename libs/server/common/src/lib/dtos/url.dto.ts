import { ApiProperty } from "@nestjs/swagger";

export class UrlDto {
    @ApiProperty({ type: 'string' })
    url: string;
}
