import { parse } from 'path';
import { spawnPromise } from './spawn-promise';

describe('spawnPromise', () => {
    it('resolves with stdout', async () => {
        const result = await spawnPromise(`ls`, [__dirname]);
        expect(result).toContain(parse(__filename).base);
    });

    it('rejects with stderr', async () => {
        try {
            await spawnPromise(`ls`, ['no way jose']);
        } catch (e) {
            expect(e).toContain('No such file or directory');
        }
    });
});