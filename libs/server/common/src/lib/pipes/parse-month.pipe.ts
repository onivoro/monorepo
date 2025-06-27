import { PipeTransform, Injectable, ArgumentMetadata, ParseUUIDPipe, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseMonthPipe implements PipeTransform {
    constructor(private propertyName: string = 'month') {}

    async transform(value: any, metadata: ArgumentMetadata) {
        const numeric = Number(value);

        if (!numeric) {
            throw new BadRequestException(`${this.propertyName} is required`)
        }

        const minMonth = 1;

        if (numeric < minMonth) {
            throw new BadRequestException(`${this.propertyName} must be greater than or equal to ${minMonth}`)
        }

        const maxMonth = 12;

        if (numeric > maxMonth) {
            throw new BadRequestException(`${this.propertyName} must be less than or equal to ${maxMonth}`)
        }

        return numeric;
    }
}