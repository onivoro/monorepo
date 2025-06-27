import { ExecOptions } from 'child_process';
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { execRx } from './exec-rx';

export const execRxAsLines = (cmd: string, options?: ExecOptions, emitStdErr = true) => {
  return execRx(cmd, options, emitStdErr).pipe(
    concatMap((s: string) => from(s.split('\n'))),
  )
};