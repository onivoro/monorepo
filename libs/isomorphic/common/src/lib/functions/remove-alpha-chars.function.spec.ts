import { removeAlphaChars } from './remove-alpha-chars.function';

describe('removeAlphaChars', () => {
    it('worx', () => {
        expect(removeAlphaChars('1234.567')).toMatchSnapshot();
        expect(removeAlphaChars(987.65)).toMatchSnapshot();
        expect(removeAlphaChars('$337.65')).toMatchSnapshot();
        expect(removeAlphaChars('$1,234.56')).toMatchSnapshot();
        expect(removeAlphaChars('dollarzzz$1,234.5six')).toMatchSnapshot();
    })
});