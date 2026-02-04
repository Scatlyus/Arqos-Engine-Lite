import type { StateStore } from "../state/state-store";
import type { MemoryEvent } from "./memory-types";

export type Embedder = (text: string) => Promise<number[]>;

export interface VectorStoreAdapter {
  upsert(record: VectorRecord): Promise<void>;
  query(embedding: number[], limit: number): Promise<VectorRecord[]>;
  healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; message?: string }>;
}

export interface VectorRecord {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  event: MemoryEvent;
  stored_at: string;
}

interface VectorialMemoryOptions {
  embedder?: Embedder;
  adapter?: VectorStoreAdapter;
  maxItems?: number;
  namespace?: string;
}

export class VectorialMemory {
  private readonly stateKey: string;
  private readonly maxItems: number;
  private readonly namespace: string;
  private readonly embedder?: Embedder;
  private readonly adapter?: VectorStoreAdapter;
  private loaded = false;
  private records = new Map<string, VectorRecord>();

  constructor(private stateStore: StateStore, options: VectorialMemoryOptions = {}) {
    this.embedder = options.embedder;
    this.adapter = options.adapter;
    this.maxItems = options.maxItems ?? Number(process.env.ARQOS_VECTORIAL_MAX_ITEMS ?? 5000);
    this.namespace = options.namespace ?? (process.env.ARQOS_VECTORIAL_NAMESPACE ?? "default");
    this.stateKey = `ae1:vectorial:${this.namespace}`;
  }

  async store(id: string, embedding: number[], metadata: Record<string, unknown>, event: MemoryEvent): Promise<void> {
    if (this.adapter) {
      await this.adapter.upsert({ id, embedding, metadata, event, stored_at: new Date().toISOString() });
      return;
    }

    await this.ensureLoaded();
    const record: VectorRecord = {
      id,
      embedding,
      metadata,
      event,
      stored_at: new Date().toISOString(),
    };
    this.records.set(id, record);

    if (this.records.size > this.maxItems) {
      this.evictOldest(this.records.size - this.maxItems);
    }

    await this.persist();
  }

  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    if (this.records.has(id)) {
      this.records.delete(id);
      await this.persist();
    }
  }

  async clear(): Promise<void> {
    this.records.clear();
    await this.persist();
  }

  async search(text: string, limit: number): Promise<MemoryEvent[]> {
    const embedding = await this.embed(text);
    const matches = await this.searchByEmbedding(embedding, limit);
    return matches.map((record) => record.event);
  }

  async searchByEmbedding(embedding: number[], limit: number): Promise<VectorRecord[]> {
    if (this.adapter) {
      return this.adapter.query(embedding, limit);
    }

    await this.ensureLoaded();
    const scored: Array<{ record: VectorRecord; score: number }> = [];

    for (const record of Array.from(this.records.values())) {
      const score = cosineSimilarity(embedding, record.embedding);
      scored.push({ record, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(1, limit)).map((entry) => entry.record);
  }

  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; message?: string }> {
    if (this.adapter) {
      return this.adapter.healthCheck();
    }
    await this.ensureLoaded();
    return { status: "healthy" };
  }

  private async embed(text: string): Promise<number[]> {
    if (this.embedder) {
      return this.embedder(text);
    }

    const dimensions = Number(process.env.ARQOS_VECTORIAL_DIMENSIONS ?? 768);
    const vector = new Array(dimensions).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const idx = code % dimensions;
      vector[idx] += 1;
    }
    const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const stored = await this.stateStore.read<VectorRecord[]>(this.stateKey);
    if (stored && Array.isArray(stored)) {
      for (const record of stored) {
        if (record && record.id && Array.isArray(record.embedding)) {
          this.records.set(record.id, record);
        }
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await this.stateStore.write(this.stateKey, Array.from(this.records.values()));
  }

  private evictOldest(count: number): void {
    if (count <= 0) {
      return;
    }
    const items = Array.from(this.records.values());
    items.sort((a, b) => a.stored_at.localeCompare(b.stored_at));
    for (let i = 0; i < count && i < items.length; i += 1) {
      this.records.delete(items[i].id);
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) {
    return 0;
  }
  return dot / denom;
}
