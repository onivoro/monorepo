import { toDollarsAndCents } from './to-dollars-and-cents.function';

describe('toDollarsAndCents', () => {
    it('worx', () => {
        expect(toDollarsAndCents(337.33)).toMatchSnapshot();
    });
});
