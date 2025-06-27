import { money } from './money.function';

describe('money', () => {
    it('worx', () => {
        expect(money('1234.567')).toMatchSnapshot();
        expect(money(987.65)).toMatchSnapshot();
        expect(money('$337.65')).toMatchSnapshot();
        expect(money('$1,234.56')).toMatchSnapshot();
    })
});