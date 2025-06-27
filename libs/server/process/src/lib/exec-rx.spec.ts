import { execRx } from './exec-rx';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

describe(execRx.name, () => {
    describe('GIVEN command succeeds', () => {
        it('returns the stdout', (done) => {
            execRx(`cat ${__filename}`).subscribe((d) => {
                expect(d).toEqual(expect.stringContaining('execRx worx!'));
                done();
            }, () => { throw new Error("fail") }
            );
        });
    });

    describe('GIVEN command fails', () => {
        it('emits error', (done) => {
            execRx(`cat ${__filename + 'blah'}`).pipe(catchError(() => of(done())))
                .subscribe();
        });
    });
});