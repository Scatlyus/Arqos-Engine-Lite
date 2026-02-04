import type { VectorRecord, VectorStoreAdapter } from "../vectorial";

interface PineconeAdapterOptions {
  apiKey: string;
  indexHost: string;
  namespace?: string;
  timeoutMs?: number;
}

interface PineconeUpsertResponse {
  upsertedCount?: number;
}

interface PineconeQueryResponse {
  matches?: Array<{
    id: string;
    score?: number;
    metadata?: Record<string, unknown>;
    values?: number[];
  }>;
}

export class PineconeAdapter implements VectorStoreAdapter {
  private readonly apiKey: string;
  private readonly indexHost: string;
  private readonly namespace: string;
  private readonly timeoutMs: number;

  constructor(options: PineconeAdapterOptions) {
    this.apiKey = options.apiKey;
    this.indexHost = options.indexHost.replace(/\/+$/, "");
    this.namespace = options.namespace ?? "default";
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async upsert(record: VectorRecord): Promise<void> {
    const body = {
      vectors: [
        {
          id: record.id,
          values: record.embedding,
          metadata: {
            ...record.metadata,
            __event: record.event,
            __stored_at: record.stored_at,
          },
        },
      ],
      namespace: this.namespace,
    };

    await this.request<PineconeUpsertResponse>("/vectors/upsert", body);
  }

  async query(embedding: number[], limit: number): Promise<VectorRecord[]> {
    const body = {
      vector: embedding,
      topK: limit,
      includeMetadata: true,
      includeValues: true,
      namespace: this.namespace,
    };

    const response = await this.request<PineconeQueryResponse>("/query", body);
    const matches = response.matches ?? [];

    return matches.map((match) => {
      const metadata = (match.metadata ?? {}) as Record<string, unknown>;
      const event = (metadata.__event as VectorRecord["event"]) ?? {
        id: match.id,
        timestamp: metadata.__stored_at ? String(metadata.__stored_at) : new Date().toISOString(),
        type: "unknown",
        metadata,
      };

      return {
        id: match.id,
        embedding: match.values ?? embedding,
        metadata,
        event,
        stored_at: metadata.__stored_at ? String(metadata.__stored_at) : new Date().toISOString(),
      };
    });
  }

  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; message?: string }> {
    try {
      await this.request<{ status?: string }>("/describe_index_stats", { namespace: this.namespace });
      return { status: "healthy" };
    } catch (error) {
      return { status: "unavailable", message: error instanceof Error ? error.message : "unknown" };
    }
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.indexHost}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Pinecone ${path} failed: ${response.status} ${text}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
