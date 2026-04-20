import { Readable } from 'stream';
import { toArray } from 'rxjs/operators';
import { listen } from './listen';

function createMockInput(chunks: string[]): NodeJS.ReadableStream {
    const readable = new Readable({
        read() {
            for (const chunk of chunks) {
                this.push(chunk);
            }
            this.push(null);
        }
    });
    return readable;
}

describe('listen', () => {
    describe('GIVEN lines mode (default)', () => {
        it('emits individual lines', (done) => {
            const input = createMockInput(['hello\nworld\n']);
            listen({ input }).pipe(toArray()).subscribe({
                next: (lines) => {
                    expect(lines).toEqual(['hello', 'world']);
                    done();
                },
                error: done,
            });
        });

        it('handles lines split across chunks', (done) => {
            const input = createMockInput(['hel', 'lo\nwor', 'ld\n']);
            listen({ input }).pipe(toArray()).subscribe({
                next: (lines) => {
                    expect(lines).toEqual(['hello', 'world']);
                    done();
                },
                error: done,
            });
        });

        it('emits final fragment without trailing newline', (done) => {
            const input = createMockInput(['abc\ndef']);
            listen({ input }).pipe(toArray()).subscribe({
                next: (lines) => {
                    expect(lines).toEqual(['abc', 'def']);
                    done();
                },
                error: done,
            });
        });
    });

    describe('GIVEN raw mode', () => {
        it('emits raw chunks without splitting', (done) => {
            const input = createMockInput(['chunk1', 'chunk2']);
            listen({ lines: false, input }).pipe(toArray()).subscribe({
                next: (chunks) => {
                    expect(chunks).toEqual(['chunk1', 'chunk2']);
                    done();
                },
                error: done,
            });
        });
    });

    describe('GIVEN unsubscription', () => {
        it('removes listeners from input stream', (done) => {
            const input = createMockInput([]);
            const sub = listen({ input, lines: false }).subscribe();
            sub.unsubscribe();
            expect(input.listenerCount('data')).toBe(0);
            done();
        });
    });
});
