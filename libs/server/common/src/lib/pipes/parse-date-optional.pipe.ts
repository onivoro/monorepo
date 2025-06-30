import { dateIso8601, isValidDate } from '@onivoro/isomorphic-common';
import { PipeTransform, Injectable, ArgumentMetadata, ParseUUIDPipe, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseDateOptionalPipe implements PipeTransform {
    constructor(private parse: boolean) { }

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!value) {
            return value;
        }

        if (!dateIso8601.test(value)) {
            throw new BadRequestException(`"${value}" does not conform to YYYY-MM-DD`);
        }

        const date = isValidDate(value);

        if (!date) {
            throw new BadRequestException(`"${value}" does not represent a valid date`);
        }

        return this.parse ? date : value;
    }
}