import type { VectorRecord, VectorStoreAdapter } from "../vectorial";

export interface PgClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface PgvectorAdapterOptions {
  client: PgClient;
  tableName?: string;
  dimensions?: number;
  autoCreate?: boolean;
}

type PgRow = {
  id: string;
  embedding: number[] | string;
  metadata: Record<string, unknown> | null;
  event: VectorRecord["event"] | null;
  stored_at: string;
};

export class PgvectorAdapter implements VectorStoreAdapter {
  private readonly client: PgClient;
  private readonly tableName: string;
  private readonly dimensions: number;
  private readonly autoCreate: boolean;
  private initialized = false;

  constructor(options: PgvectorAdapterOptions) {
    this.client = options.client;
    this.tableName = options.tableName ?? "ae1_vectorial_memory";
    this.dimensions = options.dimensions ?? Number(process.env.ARQOS_VECTORIAL_DIMENSIONS ?? 768);
    this.autoCreate = options.autoCreate ?? true;
  }

  async upsert(record: VectorRecord): Promise<void> {
    await this.ensureInitialized();
    const sql = `
      INSERT INTO ${this.tableName} (id, embedding, metadata, event, stored_at)
      VALUES ($1, $2::vector, $3::jsonb, $4::jsonb, $5::timestamptz)
      ON CONFLICT (id)
      DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata, event = EXCLUDED.event, stored_at = EXCLUDED.stored_at
    `;

    const embedding = formatVector(record.embedding);
    await this.client.query(sql, [
      record.id,
      embedding,
      record.metadata ?? {},
      record.event ?? null,
      record.stored_at,
    ]);
  }

  async query(embedding: number[], limit: number): Promise<VectorRecord[]> {
    await this.ensureInitialized();
    const sql = `
      SELECT id, embedding, metadata, event, stored_at
      FROM ${this.tableName}
      ORDER BY embedding <-> $1::vector
      LIMIT $2
    `;
    const result = await this.client.query<PgRow>(sql, [formatVector(embedding), limit]);

    return result.rows.map((row) => ({
      id: row.id,
      embedding: parseVector(row.embedding),
      metadata: row.metadata ?? {},
      event: row.event ?? {
        id: row.id,
        timestamp: row.stored_at,
        type: "unknown",
        metadata: row.metadata ?? {},
      },
      stored_at: row.stored_at,
    }));
  }

  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; message?: string }> {
    try {
      await this.ensureInitialized();
      await this.client.query("SELECT 1");
      return { status: "healthy" };
    } catch (error) {
      return { status: "unavailable", message: error instanceof Error ? error.message : "unknown" };
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.autoCreate) {
      await this.client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await this.client.query(
        `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          embedding vector(${this.dimensions}),
          metadata JSONB,
          event JSONB,
          stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        `
      );
    }
    this.initialized = true;
  }
}

function formatVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function parseVector(vector: number[] | string): number[] {
  if (Array.isArray(vector)) {
    return vector;
  }
  const trimmed = vector.replace(/^\[|\]$/g, "");
  if (!trimmed) {
    return [];
  }
  return trimmed.split(",").map((value) => Number(value));
}
