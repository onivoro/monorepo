import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecPromiseOptions extends ExecOptions {
    container?: string;
}

export function execPromise(cmd: string, options?: ExecPromiseOptions): Promise<{ stdout: string; stderr: string }> {
    const { container, ...execOptions } = options ?? {};
    const command = container ? `docker exec ${container} ${cmd}` : cmd;
    return execAsync(command, execOptions);
}
