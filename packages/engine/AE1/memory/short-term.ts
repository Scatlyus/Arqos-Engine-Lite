import type { MemoryEvent, MemoryQuery } from "./memory-types";
import type { StateStore } from "../state/state-store";

export class ShortTermMemory {
  private readonly indexKey = "short:index";

  constructor(private retentionDays: number, private stateStore: StateStore) { }

  async store(event: MemoryEvent): Promise<void> {
    // 1. Store the event data
    await this.stateStore.write(`short:${event.id}`, event);

    // 2. Update index
    const index = (await this.stateStore.read<string[]>(this.indexKey)) || [];
    if (!index.includes(event.id)) {
      index.push(event.id);
      // Simple cap to prevent infinite growth in Lite
      if (index.length > 200) index.shift();
      await this.stateStore.write(this.indexKey, index);
    }
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEvent[]> {
    const index = (await this.stateStore.read<string[]>(this.indexKey)) || [];
    const events: MemoryEvent[] = [];

    // Retrieve newest first (from end of array)
    const limit = query.limit || 50;

    for (let i = index.length - 1; i >= 0 && events.length < limit; i--) {
      const id = index[i];
      const event = await this.stateStore.read<MemoryEvent>(`short:${id}`);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  async count(): Promise<number> {
    const index = (await this.stateStore.read<string[]>(this.indexKey)) || [];
    return index.length;
  }

  async getPatterns(): Promise<string[]> {
    return []; // Patterns come from abstract/statistical now
  }
}
