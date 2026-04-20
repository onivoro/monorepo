import { execRxAsJson } from './exec-rx-as-json';

describe('execRxAsJson', () => {
    it('parses JSON output', (done) => {
        execRxAsJson<{ key: string }>(`echo '{"key":"value"}'`).subscribe({
            next: (obj) => {
                expect(obj).toEqual({ key: 'value' });
                done();
            },
            error: done,
        });
    });

    it('errors on invalid JSON', (done) => {
        execRxAsJson(`echo 'not json'`).subscribe({
            next: () => { throw new Error('should not emit'); },
            error: () => done(),
        });
    });
});
