export class LocalStorageProxy implements Storage {
  constructor(private label: string, private storage: Storage = window.localStorage) {}

  get length(): number {
    console.warn(`[LocalStorage: ${this.label}] get length`);
    return this.storage.length;
  }

  clear(): void {
    console.warn(`[LocalStorage: ${this.label}] clear`);
    this.storage.clear();
    console.warn(`[LocalStorage: ${this.label}] clear completed`);
  }

  getItem(key: string): string | null {
    console.warn(`[LocalStorage: ${this.label}] getItem`, { key });
    const value = this.storage.getItem(key);
    console.warn(`[LocalStorage: ${this.label}] getItem result:`, value);
    return value;
  }

  key(index: number): string | null {
    console.warn(`[LocalStorage: ${this.label}] key`, { index });
    const value = this.storage.key(index);
    console.warn(`[LocalStorage: ${this.label}] key result:`, value);
    return value;
  }

  removeItem(key: string): void {
    console.warn(`[LocalStorage: ${this.label}] removeItem`, { key });
    this.storage.removeItem(key);
    console.warn(`[LocalStorage: ${this.label}] removeItem completed`);
  }

  setItem(key: string, value: string): void {
    console.warn(`[LocalStorage: ${this.label}] setItem`, { key, value });
    if(this.label !== 'userStore') {
        this.storage.setItem(key, value);
    }
    console.warn(`[LocalStorage: ${this.label}] setItem completed`);
  }
}
