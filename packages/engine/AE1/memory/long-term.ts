import type { MemoryEvent, MemoryQuery } from "./memory-types";
import type { StateStore } from "../state/state-store";

export class LongTermMemory {
  constructor(private retentionDays: number, private stateStore: StateStore) {}

  async store(event: MemoryEvent): Promise<void> {
    await this.stateStore.write(`long:${event.id}`, event);
  }

  async retrieve(_query: MemoryQuery): Promise<MemoryEvent[]> {
    return [];
  }
}
