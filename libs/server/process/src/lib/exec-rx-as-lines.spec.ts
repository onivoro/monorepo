import { execRxAsLines } from './exec-rx-as-lines';
import { toArray } from 'rxjs/operators';

describe('execRxAsLines', () => {
    it('emits individual lines', (done) => {
        execRxAsLines(`printf "line1\nline2\nline3"`).pipe(toArray()).subscribe({
            next: (lines) => {
                expect(lines).toContain('line1');
                expect(lines).toContain('line2');
                expect(lines).toContain('line3');
                done();
            },
            error: done,
        });
    });

    it('does not emit empty lines', (done) => {
        execRxAsLines(`printf "a\n\nb"`).pipe(toArray()).subscribe({
            next: (lines) => {
                expect(lines).toEqual(['a', 'b']);
                done();
            },
            error: done,
        });
    });
});
