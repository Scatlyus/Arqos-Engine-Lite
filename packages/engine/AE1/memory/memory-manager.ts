import type { MemoryEvent, MemoryInsights, MemoryQuery } from "./memory-types";
import { ShortTermMemory } from "./short-term";
import { LongTermMemory } from "./long-term";
import { VectorialMemory } from "./vectorial";
import type { VectorStoreAdapter } from "./vectorial";
import { PineconeAdapter } from "./adapters/pinecone-adapter";
import { PgvectorAdapter } from "./adapters/pgvector-adapter";
import { WeaviateAdapter } from "./adapters/weaviate-adapter";
import type { StateStore } from "../state/state-store";

export class MemoryManager {
  private shortTerm: ShortTermMemory;
  private longTerm?: LongTermMemory;
  private vectorial?: VectorialMemory;
  private mode: "lite" | "fullstack";

  constructor(mode: "lite" | "fullstack", stateStore: StateStore) {
    this.mode = mode;
    this.shortTerm = new ShortTermMemory(7, stateStore);

    // Initialize Vectorial Memory in both modes
    // Lite will default to local/in-memory because resolveVectorAdapter returns undefined by default
    this.vectorial = new VectorialMemory(stateStore, {
      embedder: (text) => this.createEmbeddingFromText(text),
      adapter: this.resolveVectorAdapter(),
      namespace: mode
    });

    if (mode === "fullstack") {
      this.longTerm = new LongTermMemory(180, stateStore);
    }
  }

  async store(event: MemoryEvent): Promise<void> {
    await this.shortTerm.store(event);

    // Store in Vectorial (always active now)
    if (this.vectorial) {
      const embedding = await this.createEmbedding(event);
      await this.vectorial.store(event.id, embedding, event.metadata ?? {}, event);
    }

    if (this.mode === "fullstack") {
      await this.longTerm!.store(event);
    }
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEvent[]> {
    if (query.type === "semantic") {
      // Search vectorial in any mode
      if (this.vectorial) {
        return await this.vectorial.search(query.text ?? "", query.limit ?? 10);
      }
      return [];
    }

    if (query.timeframe === "recent") {
      return await this.shortTerm.retrieve(query);
    }

    if (this.mode === "fullstack") {
      return await this.longTerm!.retrieve(query);
    }

    return await this.shortTerm.retrieve(query);
  }

  async getInsights(): Promise<MemoryInsights> {
    return {
      total_events: await this.shortTerm.count(),
      recent_patterns: await this.shortTerm.getPatterns(),
      memory_usage_mb: await this.getMemoryUsage(),
    };
  }

  private async createEmbedding(event: MemoryEvent): Promise<number[]> {
    // Create rich text representation
    const text = [
      event.type,
      event.outcome ?? "",
      event.duration_ms?.toString() ?? "",
      JSON.stringify(event.metadata ?? {}),
    ]
      .filter(Boolean)
      .join(" ");

    // Use shared implementation
    return this.createEmbeddingFromText(text);
  }

  private async createEmbeddingFromText(text: string): Promise<number[]> {
    const dimensions = Number(process.env.ARQOS_VECTORIAL_DIMENSIONS ?? 768);
    const provider = (process.env.ARQOS_EMBEDDING_PROVIDER ?? "local").toLowerCase();

    // Improved Bag-of-Words Hashing for Local Implementation
    const localEmbedding = (): number[] => {
      const vector = new Array(dimensions).fill(0);

      // Tokenize by words, lowercase, remove common punctuation
      const tokens = text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/);

      for (const token of tokens) {
        if (!token) continue;

        // Hash string to generic integer
        let hash = 0;
        for (let i = 0; i < token.length; i++) {
          const char = token.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }

        // Map hash to dimension index
        const idx = Math.abs(hash) % dimensions;
        vector[idx] += 1;
      }

      // Normalize (L2)
      const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
      return vector.map((v) => Number((v / norm).toFixed(6)));
    };

    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.ARQOS_OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
            input: text,
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { data?: Array<{ embedding: number[] }> };
          const embedding = payload.data?.[0]?.embedding;
          if (embedding && embedding.length > 0) {
            return embedding;
          }
        }
      } catch {
        // fallback to local embedding
      }
    }

    if (provider === "cohere" && process.env.COHERE_API_KEY) {
      try {
        const response = await fetch("https://api.cohere.ai/v1/embed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.ARQOS_COHERE_EMBEDDING_MODEL ?? "embed-english-v3.0",
            texts: [text],
            input_type: "search_document",
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { embeddings?: number[][] };
          const embedding = payload.embeddings?.[0];
          if (embedding && embedding.length > 0) {
            return embedding;
          }
        }
      } catch {
        // fallback to local embedding
      }
    }

    return localEmbedding();
  }

  private async getMemoryUsage(): Promise<number> {
    const usageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    return Number(usageMb.toFixed(2));
  }

  private resolveVectorAdapter(): VectorStoreAdapter | undefined {
    const provider = (process.env.ARQOS_VECTORIAL_PROVIDER ?? "memory").toLowerCase();

    if (provider === "pinecone") {
      const apiKey = process.env.ARQOS_PINECONE_API_KEY;
      const indexHost = process.env.ARQOS_PINECONE_INDEX_HOST;
      if (!apiKey || !indexHost) {
        console.warn("[AE1] Pinecone adapter requested but missing API key or index host. Falling back to in-memory.");
        return undefined;
      }
      return new PineconeAdapter({
        apiKey,
        indexHost,
        namespace: process.env.ARQOS_VECTORIAL_NAMESPACE,
        timeoutMs: Number(process.env.ARQOS_PINECONE_TIMEOUT_MS ?? 5000),
      });
    }

    if (provider === "pgvector") {
      const client = (globalThis as unknown as { ARQOS_PGVECTOR_CLIENT?: unknown }).ARQOS_PGVECTOR_CLIENT;
      if (!client || typeof (client as { query?: unknown }).query !== "function") {
        console.warn("[AE1] Pgvector adapter requested but ARQOS_PGVECTOR_CLIENT is not set. Falling back to in-memory.");
        return undefined;
      }
      return new PgvectorAdapter({
        client: client as any,
        tableName: process.env.ARQOS_PGVECTOR_TABLE,
        dimensions: Number(process.env.ARQOS_VECTORIAL_DIMENSIONS ?? 768),
        autoCreate: (process.env.ARQOS_PGVECTOR_AUTOCREATE ?? "true").toLowerCase() !== "false",
      });
    }

    if (provider === "weaviate") {
      const host = process.env.ARQOS_WEAVIATE_HOST;
      if (!host) {
        console.warn("[AE1] Weaviate adapter requested but ARQOS_WEAVIATE_HOST is missing. Falling back to in-memory.");
        return undefined;
      }
      return new WeaviateAdapter({
        host,
        apiKey: process.env.ARQOS_WEAVIATE_API_KEY,
        className: process.env.ARQOS_WEAVIATE_CLASS,
        timeoutMs: Number(process.env.ARQOS_WEAVIATE_TIMEOUT_MS ?? 5000),
      });
    }

    return undefined;
  }
}
