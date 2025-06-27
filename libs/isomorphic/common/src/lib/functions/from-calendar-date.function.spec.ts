import { fromCalendarDate } from './from-calendar-date.function';

describe('fromCalendarDate', () => {
    describe('GIVEN input is partial or full ISO8601', () => {
        it.each([
            '2023-12-23',
        ])('%j', (input) => {
            expect(fromCalendarDate(input)).toMatchSnapshot();
        });
    });
});