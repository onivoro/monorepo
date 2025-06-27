import { createServer } from "net";

export async function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const tester = createServer()
            .once('error', (err) => {
                resolve(false);
            })
            .once('listening', () => {
                tester.close();
                resolve(false);
            })
            .listen(port, 'localhost');
    });
}
