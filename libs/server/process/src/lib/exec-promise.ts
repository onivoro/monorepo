import { exec, ExecOptions } from "child_process";
import { EncodingOption } from "fs";

export function execPromise(cmd: string, options?: EncodingOption & ExecOptions): Promise<any> {
    return new Promise((resolve, reject) => {
        exec(cmd, options, (err, stdout) => {
            if (err) {
                reject(err);
            } else {
                resolve(stdout.toString());
            }
        });
    });
}