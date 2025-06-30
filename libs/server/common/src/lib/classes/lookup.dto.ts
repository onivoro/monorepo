import { ApiProperty } from '@nestjs/swagger';
import { ILookup } from "@onivoro/isomorphic-common";

export class LookupDto implements ILookup<string, string> {
    @ApiProperty({ type: 'string' }) value: string;
    @ApiProperty({ type: 'string' }) display: string;
}