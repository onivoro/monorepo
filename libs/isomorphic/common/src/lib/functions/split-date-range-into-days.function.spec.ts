import { splitDateRangeIntoDays } from './split-date-range-into-days.function';
import { arrangeActAssert } from '../functions/arrange-act-assert.function';
describe('splitDateRangeIntoDays', () => {
    it.each([
        [{ from: '', to: '' }],
        [{ from: 'asdf', to: '2345' }],
        [{ from: '2024-01-01', to: '2024-01-01' }],
        [{ from: '2024-01-01', to: '2024-02-01' }],
        [{ from: '2025-01-01', to: '' }],
    ])('given %j, returns an array of days', async (_) => await arrangeActAssert({
        arrange: () => ({ subject: splitDateRangeIntoDays }),
        act: ({ subject }) => subject(_),
        assert: ({ result }) => {
            expect(result).toMatchSnapshot();
        }
    }));
});