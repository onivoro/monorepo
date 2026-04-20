import { map, reduce } from 'rxjs/operators';
import { execRx, ExecRxOptions } from './exec-rx';

export const execRxAsJson = <T = unknown>(cmd: string, options?: ExecRxOptions) => {
    return execRx(cmd, options).pipe(
        reduce((acc, chunk) => acc + chunk, ''),
        map((s: string) => JSON.parse(s) as T),
    );
};
