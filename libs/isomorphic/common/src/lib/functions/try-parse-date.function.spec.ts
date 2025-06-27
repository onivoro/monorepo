import { tryParseDate } from './try-parse-date.function';

describe('tryParseDate', () => {
    describe('GIVEN input is partial or full ISO8601', () => {
        it.each([
            '2023-12-23',
            '2023-12-23T00:00:00.000',
        ])('%j', (input) => {
            expect(tryParseDate(input)).toMatchSnapshot();
        });
    });
});