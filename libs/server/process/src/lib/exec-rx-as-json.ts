import { ExecOptions } from 'child_process';
import { map } from 'rxjs/operators';
import { execRx } from './exec-rx';

export const execRxAsJson = (cmd: string, options?: ExecOptions, emitStdErr = true) => {
  return execRx(cmd, options, emitStdErr).pipe(
    map((s: string) => JSON.parse(s)),
  )
};