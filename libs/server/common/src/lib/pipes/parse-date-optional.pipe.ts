import { dateIso8601, isValidDate } from '@onivoro/isomorphic-common';
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseDateOptionalPipe implements PipeTransform {
  constructor(private parse: boolean) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      return value;
    }

    if (!dateIso8601.test(value)) {
      throw new BadRequestException(
        `"${value}" does not conform to YYYY-MM-DD`,
      );
    }

    const date = isValidDate(value);

    const [year, month, day] = value.split('-').map(Number);
    const expected = new Date(0);
    expected.setUTCFullYear(year, month - 1, day);

    if (
      !date ||
      expected.getUTCFullYear() !== year ||
      expected.getUTCMonth() !== month - 1 ||
      expected.getUTCDate() !== day
    ) {
      throw new BadRequestException(
        `"${value}" does not represent a valid date`,
      );
    }

    return this.parse ? date : value;
  }
}
