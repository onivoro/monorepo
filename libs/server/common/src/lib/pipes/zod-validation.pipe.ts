import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { tryJsonParse } from '@onivoro/isomorphic-common';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = tryJsonParse(result?.error as any);
      throw new BadRequestException(message || 'Validation failed');
    }
    return result.data;
  }
}