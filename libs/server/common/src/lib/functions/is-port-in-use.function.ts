import { createServer } from 'net';

export async function isPortInUse(
  port: number,
  host = 'localhost',
): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        resolve(err.code === 'EADDRINUSE');
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}
