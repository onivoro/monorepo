import { Subject } from 'rxjs';
import { splitLines } from './split-lines';

describe('splitLines', () => {
  function collect() {
    const source = new Subject<string>();
    const lines: string[] = [];
    const result: { error?: unknown; completed: boolean } = {
      completed: false,
    };
    const sub = splitLines(source).subscribe({
      next: (line) => lines.push(line),
      error: (error) => (result.error = error),
      complete: () => (result.completed = true),
    });
    return { source, lines, result, sub };
  }

  it('emits complete lines as soon as their newline arrives', () => {
    const { source, lines } = collect();

    source.next('one\ntw');
    expect(lines).toEqual(['one']);

    source.next('o\nthree');
    expect(lines).toEqual(['one', 'two']);
  });

  it('flushes the trailing fragment on completion', () => {
    const { source, lines, result } = collect();

    source.next('a\nb');
    source.complete();

    expect(lines).toEqual(['a', 'b']);
    expect(result.completed).toBe(true);
  });

  it('skips empty lines and does not emit an empty trailing fragment', () => {
    const { source, lines } = collect();

    source.next('\n\na\n\n');
    source.complete();

    expect(lines).toEqual(['a']);
  });

  it('propagates errors without flushing the buffer', () => {
    const { source, lines, result } = collect();
    const error = new Error('boom');

    source.next('partial');
    source.error(error);

    expect(lines).toEqual([]);
    expect(result.error).toBe(error);
    expect(result.completed).toBe(false);
  });

  it('unsubscribes from the source when unsubscribed', () => {
    const { source, sub } = collect();

    sub.unsubscribe();

    expect(source.observed).toBe(false);
  });
});
