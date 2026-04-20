import { Observable } from 'rxjs';

export function splitLines(source$: Observable<string>): Observable<string> {
    return new Observable<string>((observer) => {
        let buffer = '';
        return source$.subscribe({
            next(chunk) {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (line) observer.next(line);
                }
            },
            error(err) { observer.error(err); },
            complete() {
                if (buffer) observer.next(buffer);
                observer.complete();
            }
        });
    });
}
