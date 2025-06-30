import { v4 } from '@onivoro/isomorphic-common';
import { ArgumentMetadata } from '@nestjs/common';
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseUUIDsPipe implements PipeTransform {
    constructor(private property?: string) { }
    transform(body: any, metadata: ArgumentMetadata) {

        let value = this.property ? body[this.property] : body;

        if (!Array.isArray(value)) {
            throw new BadRequestException('Expected an array of UUIDs.');
        }

        const invalidUuids = value.filter((uuid) => !v4.test(uuid))

        if (invalidUuids.length > 0) {
            throw new BadRequestException(
                `Invalid UUID(s)${this.property ? ` for "${this.property}"` : ''}: ${invalidUuids.join(', ')}`,
            );
        }

        return this.property ? { ...body, [this.property]: value } : value;
    }
}