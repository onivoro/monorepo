import { McpMemoryClientsStore } from './mcp-memory-clients-store';

describe('McpMemoryClientsStore', () => {
  let store: McpMemoryClientsStore;

  beforeEach(() => {
    store = new McpMemoryClientsStore();
  });

  it('should register a client and assign a UUID', async () => {
    const client = await store.registerClient({
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:3000/callback'],
    });

    expect(client.client_id).toBeDefined();
    expect(typeof client.client_id).toBe('string');
    expect(client.client_id.length).toBeGreaterThan(0);
    expect(client.client_name).toBe('Test Client');
    expect(client.client_id_issued_at).toBeDefined();
  });

  it('should retrieve a registered client by ID', async () => {
    const registered = await store.registerClient({ client_name: 'My Client' });
    const retrieved = await store.getClient(registered.client_id);

    expect(retrieved).toEqual(registered);
  });

  it('should return undefined for unknown client ID', async () => {
    const result = await store.getClient('non-existent-id');
    expect(result).toBeUndefined();
  });

  it('should generate unique IDs for each client', async () => {
    const client1 = await store.registerClient({ client_name: 'Client 1' });
    const client2 = await store.registerClient({ client_name: 'Client 2' });

    expect(client1.client_id).not.toBe(client2.client_id);
  });

  it('should seed a client with a known ID', () => {
    store.seedClient('known-id', { client_name: 'Seeded' });

    expect(store.size).toBe(1);
  });

  it('should retrieve a seeded client', async () => {
    store.seedClient('known-id', { client_name: 'Seeded' });

    const client = await store.getClient('known-id');
    expect(client).toBeDefined();
    expect(client.client_id).toBe('known-id');
    expect(client.client_name).toBe('Seeded');
  });

  it('should clear all clients', async () => {
    await store.registerClient({ client_name: 'A' });
    await store.registerClient({ client_name: 'B' });

    expect(store.size).toBe(2);

    store.clear();

    expect(store.size).toBe(0);
  });
});
