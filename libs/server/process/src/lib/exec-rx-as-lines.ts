import { execRx, ExecRxOptions } from './exec-rx';
import { splitLines } from './split-lines';

export const execRxAsLines = (cmd: string, options?: ExecRxOptions) => {
    return splitLines(execRx(cmd, options));
};
