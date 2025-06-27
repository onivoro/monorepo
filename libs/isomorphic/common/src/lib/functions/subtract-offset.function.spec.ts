import { subtractOffset } from './subtract-offset.function';

describe('subtractOffset', () => {
    describe('GIVEN input is partial or full ISO8601', () => {
        it.each([
            '2023-12-23',
            '2023-12-23T00:00:00.000',
        ])('%j', (input) => {
            expect(subtractOffset(input)).toMatchSnapshot();
        });
    });
});