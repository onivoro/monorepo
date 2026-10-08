import { AddressInfo, createServer, Server } from 'net';
import { isPortInUse } from './is-port-in-use.function';

function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('isPortInUse', () => {
  it('resolves false for a free (ephemeral) port', async () => {
    await expect(isPortInUse(0)).resolves.toBe(false);
  });

  it('resolves true for a port that is already bound', async () => {
    const server = await listen();
    const { port } = server.address() as AddressInfo;

    try {
      await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(true);
    } finally {
      await close(server);
    }
  });

  it('resolves false for a port once it has been freed', async () => {
    const server = await listen();
    const { port } = server.address() as AddressInfo;
    await close(server);

    await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(false);
  });
});
