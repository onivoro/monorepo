import { spawn } from "child_process";

const data = 'data';

export function spawnPromise(program: string, args?: string[], options?: any) {
    return new Promise((res, rej) => {
        let stdout: string[] = [];
        let stderr: string[] = [];

        const proc = spawn(program, args, options);

        proc.stdout.on(data, (data) => {
            stdout.push(`${data}`);
        });

        proc.stderr.on(data, (data) => {
            stderr.push(`${data}`);
        });

        proc.on('close', (code) => {
            if (code) {
                rej(stderr.join(' '));
            } else {
                res(stdout.join(' '));
            }
 
            stdout = undefined as any;
            stderr = undefined as any;
        });
    });
}