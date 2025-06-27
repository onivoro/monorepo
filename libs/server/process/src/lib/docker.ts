import { ExecOptions } from "child_process";
import { EncodingOption } from "fs";
import { execRx } from "./exec-rx";

export class Docker {
  constructor(
    public readonly containerName: string,
    public readonly binaryName: string,
  ) { }

  execRx(cmd: string, options?: EncodingOption & ExecOptions, emitStdErr=true) {
    return execRx(`docker exec ${this.containerName} ${this.binaryName} ${cmd}`, options, emitStdErr);
  }
}