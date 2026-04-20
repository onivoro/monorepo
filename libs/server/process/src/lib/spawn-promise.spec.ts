import { parse } from 'path';
import { spawnPromise } from './spawn-promise';

describe('spawnPromise', () => {
    it('resolves with stdout', async () => {
        const result = await spawnPromise('ls', [__dirname]);
        expect(result).toContain(parse(__filename).base);
    });

    it('rejects with stderr on non-zero exit', async () => {
        try {
            await spawnPromise('ls', ['no way jose']);
            fail('should have rejected');
        } catch (e: any) {
            expect(e.message).toContain('No such file or directory');
        }
    });

    it('rejects when program is not found', async () => {
        await expect(spawnPromise('nonexistent_command_xyz_12345')).rejects.toThrow();
    });
});
