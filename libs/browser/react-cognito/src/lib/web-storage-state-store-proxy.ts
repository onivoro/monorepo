import { WebStorageStateStore } from 'oidc-client-ts';

export class WebStorageStateStoreProxy extends WebStorageStateStore {
    constructor({store: _store}: {store: Storage}) {
        const store = localStorage;

        super({ store });
    }

    async get(key: string): Promise<any> {
        const result = await super.get(key);
        console.warn('[WebStorageStateStore] get', { key, result });
        return result;
    }

    async set(key: string, value: any): Promise<void> {
        console.warn('[WebStorageStateStore] set', { key, value });
        await super.set(key, value);
    }

    async remove(key: string): Promise<any> {
        const result = await super.remove(key);
        console.warn('[WebStorageStateStore] remove', { key, result });
        return result;
    }

    async getAllKeys(): Promise<string[]> {
        const keys = await super.getAllKeys();
        console.warn('[WebStorageStateStore] getAllKeys', { keys });
        return keys;
    }
}
