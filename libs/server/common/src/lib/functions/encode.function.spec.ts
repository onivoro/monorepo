import { decode } from './decode.function';
import { encode } from './encode.function';

describe('encode', () => {
    it('worx for hacky situations', () => {
        const encoded = encode({ key: 'value' });
        expect(decode(encoded).key).toMatchSnapshot();
    });

});