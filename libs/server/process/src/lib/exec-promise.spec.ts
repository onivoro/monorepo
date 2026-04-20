import { parse } from 'path';
import { execPromise } from './exec-promise';

describe('execPromise', () => {
    it('resolves with stdout', async () => {
        const { stdout } = await execPromise(`ls ${__dirname}`);
        expect(stdout).toContain(parse(__filename).base);
    });

    it('rejects with stderr', async () => {
        try {
            await execPromise(`ls 'no way jose'`);
        } catch (e: any) {
            expect(e.message.replace(/\n/g, ' ')).toContain('No such file or directory');
        }
    });
});