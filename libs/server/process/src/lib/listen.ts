import { Subject } from 'rxjs';

const stdin = new Subject();
const stdout = new Subject();

export const listen = () => {

    process.stdin.on('data', d => stdin.next(d));
    process.stdin.on('close', () => stdin.complete());

    return { stdout, stdin };
}
