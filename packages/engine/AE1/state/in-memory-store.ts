import { StateStore } from "./state-store";

export class InMemoryStore extends StateStore {
  private store = new Map<string, unknown>();

  async write(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async read<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
}
