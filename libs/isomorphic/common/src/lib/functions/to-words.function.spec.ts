import { toWords } from "./to-words.function";

describe('toWords', () => {
    it('worx', () => {
        expect(toWords(337)).toMatchSnapshot();
    });
});
