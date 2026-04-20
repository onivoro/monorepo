import { spawn, SpawnOptions } from 'child_process';
import { Observable } from 'rxjs';

export interface ExecRxOptions extends SpawnOptions {
    emitStdErr?: boolean;
    container?: string;
}

export function execRx(cmd: string, options?: ExecRxOptions): Observable<string> {
    const { emitStdErr = true, container, ...spawnOptions } = options ?? {};
    const command = container ? `docker exec ${container} ${cmd}` : cmd;

    return new Observable<string>((observer) => {
        if (spawnOptions.signal?.aborted) {
            observer.complete();
            return;
        }

        const proc = spawn(command, [], { shell: true, ...spawnOptions });

        proc.stdout?.on('data', (data: Buffer) => {
            observer.next(data.toString());
        });

        if (emitStdErr) {
            proc.stderr?.on('data', (data: Buffer) => {
                observer.next(data.toString());
            });
        }

        proc.on('error', (err) => {
            if (err.name === 'AbortError') {
                observer.complete();
            } else {
                observer.error(err);
            }
        });

        proc.on('close', (code) => {
            if (code !== 0 && !spawnOptions.signal?.aborted) {
                observer.error(new Error(`Process exited with code ${code}`));
            } else {
                observer.complete();
            }
        });

        return () => {
            if (!proc.killed) {
                proc.kill();
            }
        };
    });
}
