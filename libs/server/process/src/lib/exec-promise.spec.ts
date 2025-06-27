import { parse } from 'path';
import { execPromise } from './exec-promise';

describe('execPromise', () => {
    it('resolves with stdout', async () => {
        const result = await execPromise(`ls ${__dirname}`);
        expect(result).toContain(parse(__filename).base);
    });

    it('rejects with stderr', async () => {
        try {
            await execPromise(`ls 'no way jose'`);
        } catch (e) {
            expect(e.message.replace(/\n/g, ' ')).toContain('No such file or directory');
        }
    });
});