import { VectorialMemory } from "../memory/vectorial";
import { StateStore } from "../state/state-store";
import type { MemoryEvent } from "../memory/memory-types";

class InMemoryStateStore extends StateStore {
  private store = new Map<string, unknown>();

  async write(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async read<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
}

const makeEvent = (id: string): MemoryEvent => ({
  id,
  timestamp: new Date().toISOString(),
  type: "test",
  metadata: { id }
});

const embedder = async (text: string): Promise<number[]> => {
  if (text.includes("A")) return [1, 0];
  if (text.includes("B")) return [0, 1];
  if (text.includes("C")) return [1, 1];
  return [0, 0];
};

describe("VectorialMemory", () => {
  test("persists records via StateStore", async () => {
    const stateStore = new InMemoryStateStore();
    const memory = new VectorialMemory(stateStore, { embedder, maxItems: 10 });

    await memory.store("A", [1, 0], { label: "A" }, makeEvent("A"));
    await memory.store("B", [0, 1], { label: "B" }, makeEvent("B"));

    const newMemory = new VectorialMemory(stateStore, { embedder, maxItems: 10 });
    const results = await newMemory.search("A", 1);

    expect(results.length).toBe(1);
    expect(results[0].id).toBe("A");
  });

  test("search returns most similar vectors", async () => {
    const stateStore = new InMemoryStateStore();
    const memory = new VectorialMemory(stateStore, { embedder, maxItems: 10 });

    await memory.store("A", [1, 0], { label: "A" }, makeEvent("A"));
    await memory.store("B", [0, 1], { label: "B" }, makeEvent("B"));
    await memory.store("C", [1, 1], { label: "C" }, makeEvent("C"));

    const results = await memory.search("A", 2);

    expect(results[0].id).toBe("A");
  });

  test("evicts oldest records when maxItems exceeded", async () => {
    jest.useFakeTimers();
    const stateStore = new InMemoryStateStore();
    const memory = new VectorialMemory(stateStore, { embedder, maxItems: 2 });

    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await memory.store("A", [1, 0], { label: "A" }, makeEvent("A"));

    jest.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    await memory.store("B", [0, 1], { label: "B" }, makeEvent("B"));

    jest.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));
    await memory.store("C", [1, 1], { label: "C" }, makeEvent("C"));

    const results = await memory.search("A", 5);
    const ids = results.map((event) => event.id);

    expect(ids).not.toContain("A");
    expect(ids).toContain("B");
    expect(ids).toContain("C");

    jest.useRealTimers();
  });
});
