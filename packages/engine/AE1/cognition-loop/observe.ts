import type { MemoryEvent } from "../memory/memory-types";
import type { Observation } from "./loop-types";

export function observeEvents(events: MemoryEvent[]): Observation[] {
  return events.map((event) => ({
    event_id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    outcome: event.outcome,
    duration_ms: event.duration_ms ?? 0,
  }));
}
