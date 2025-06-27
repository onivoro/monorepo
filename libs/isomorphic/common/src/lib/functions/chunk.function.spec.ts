import { chunk } from './chunk.function';
import { arrangeActAssert } from '../functions/arrange-act-assert.function';

const array = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

describe('chunk', () => {
    it.each([
        [1],
        [2],
        [3],
        [4],
        [5],
    ])('given %j, returns an array of arrays', async (_) => await arrangeActAssert({
        arrange: () => ({ subject: chunk }),
        act: ({ subject }) => subject(array, _),
        assert: ({ result }) => {
            expect(result).toMatchSnapshot();
        }
    }));
});