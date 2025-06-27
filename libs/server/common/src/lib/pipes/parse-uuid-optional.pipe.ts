import { PipeTransform, Injectable, ArgumentMetadata, ParseUUIDPipe } from '@nestjs/common';

@Injectable()
export class ParseUUIDOptionalPipe implements PipeTransform {
    constructor() { }

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!value) {
            return undefined;
        }

        const pipe = new ParseUUIDPipe({ version: '4' });

        return await pipe.transform(value, metadata);
    }
}