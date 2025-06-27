import { PipeTransform, Injectable, ArgumentMetadata, ParseUUIDPipe, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseYearPipe implements PipeTransform {
    constructor(private propertyName: string = 'year', private minYear: number = 2024) { }

    async transform(value: any, metadata: ArgumentMetadata) {
        const numeric = Number(value);

        if (!numeric) {
            throw new BadRequestException(`${this.propertyName} is required`)
        }

        if (numeric < this.minYear) {
            throw new BadRequestException(`${this.propertyName} must be greater than or equal to ${this.minYear}`)
        }

        const maxYear = (new Date()).getUTCFullYear();

        if (numeric > maxYear) {
            throw new BadRequestException(`${this.propertyName} must be less than or equal to ${maxYear}`)
        }

        return numeric;
    }
}