import { spawn, SpawnOptions } from 'child_process';

export interface SpawnPromiseOptions extends SpawnOptions {
    container?: string;
}

export function spawnPromise(program: string, args?: string[], options?: SpawnPromiseOptions): Promise<string> {
    const { container, ...spawnOptions } = options ?? {};

    return new Promise((resolve, reject) => {
        const stdout: string[] = [];
        const stderr: string[] = [];

        const finalProgram = container ? 'docker' : program;
        const finalArgs = container ? ['exec', container, program, ...(args ?? [])] : (args ?? []);
        const proc = spawn(finalProgram, finalArgs, spawnOptions);

        proc.stdout?.on('data', (data) => {
            stdout.push(data.toString());
        });

        proc.stderr?.on('data', (data) => {
            stderr.push(data.toString());
        });

        proc.on('error', (err) => {
            reject(err);
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.join('')));
            } else {
                resolve(stdout.join(''));
            }
        });
    });
}
