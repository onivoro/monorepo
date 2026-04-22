import { Injectable } from '@nestjs/common';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import * as crypto from 'crypto';

/**
 * In-memory `OAuthRegisteredClientsStore` for development and testing.
 *
 * Stores registered OAuth clients in a `Map`. Data is lost on process restart.
 * For production, implement `OAuthRegisteredClientsStore` with a persistent backend
 * (database, Redis, etc.).
 */
@Injectable()
export class McpMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, any>();

  async getClient(clientId: string): Promise<any | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(clientMetadata: any): Promise<any> {
    const clientId = crypto.randomUUID();
    const client = {
      ...clientMetadata,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(clientId, client);
    return client;
  }

  /** Test helper: pre-seed a client with a known ID. */
  seedClient(clientId: string, metadata: any): void {
    this.clients.set(clientId, { ...metadata, client_id: clientId });
  }

  /** Test helper: clear all clients. */
  clear(): void {
    this.clients.clear();
  }

  /** Test helper: get the number of registered clients. */
  get size(): number {
    return this.clients.size;
  }
}
