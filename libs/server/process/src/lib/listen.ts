import { Observable } from 'rxjs';
import { splitLines } from './split-lines';

export interface ListenOptions {
    lines?: boolean;
    input?: NodeJS.ReadableStream;
}

export function listen(options?: ListenOptions): Observable<string> {
    const { lines = true, input = process.stdin } = options ?? {};

    const raw$ = new Observable<string>((observer) => {
        const onData = (data: Buffer | string) => observer.next(data.toString());
        const onError = (err: Error) => observer.error(err);
        const onEnd = () => observer.complete();

        input.on('data', onData);
        input.on('error', onError);
        input.on('end', onEnd);

        return () => {
            input.removeListener('data', onData);
            input.removeListener('error', onError);
            input.removeListener('end', onEnd);
        };
    });

    return lines ? splitLines(raw$) : raw$;
}
