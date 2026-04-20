import { execRx } from './exec-rx';
import { of } from 'rxjs';
import { catchError, reduce } from 'rxjs/operators';

// execRx worx!
describe(execRx.name, () => {
    describe('GIVEN command succeeds', () => {
        it('returns the stdout', (done) => {
            execRx(`cat ${__filename}`).pipe(
                reduce((acc, chunk) => acc + chunk, ''),
            ).subscribe((d) => {
                expect(d).toEqual(expect.stringContaining('execRx worx!'));
                done();
            }, () => { throw new Error('fail'); });
        });
    });

    describe('GIVEN command fails', () => {
        it('emits error', (done) => {
            execRx(`cat ${__filename + 'blah'}`).pipe(catchError(() => of(done())))
                .subscribe();
        });
    });

    describe('GIVEN emitStdErr is false', () => {
        it('does not include stderr in output', (done) => {
            execRx(`echo ok 1>&2`, { emitStdErr: false }).pipe(
                reduce((acc, chunk) => acc + chunk, ''),
            ).subscribe({
                next: (d) => {
                    expect(d).toBe('');
                    done();
                },
                error: done,
            });
        });
    });

    describe('GIVEN AbortSignal is provided', () => {
        it('completes cleanly when signal fires', (done) => {
            const ac = new AbortController();
            execRx('sleep 60', { signal: ac.signal }).subscribe({
                error: () => { throw new Error('should not error'); },
                complete: () => done(),
            });
            ac.abort();
        });

        it('completes immediately if signal is already aborted', (done) => {
            const ac = new AbortController();
            ac.abort();
            execRx('sleep 60', { signal: ac.signal }).subscribe({
                error: () => { throw new Error('should not error'); },
                complete: () => done(),
            });
        });
    });

    describe('GIVEN unsubscription', () => {
        it('cleans up the child process', (done) => {
            const sub = execRx('sleep 60').subscribe();
            setTimeout(() => {
                sub.unsubscribe();
                done();
            }, 100);
        });
    });
});
