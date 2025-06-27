import { execSync } from 'child_process';

export function shell(cmd: string) {
  console.log(`\n${cmd}`);
  const output = execSync(cmd).toString();
  console.log(`${output}\n`);
  return output;
}
