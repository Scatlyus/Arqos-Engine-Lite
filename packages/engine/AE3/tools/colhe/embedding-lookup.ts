import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type EmbeddingRecord = {
  id: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

type EmbeddingMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

type EmbeddingLookupOutput = {
  query: string;
  matches: EmbeddingMatch[];
  used_index_size: number;
};

export class EmbeddingLookup implements Tool {
  id = "T11";
  name = "EmbeddingLookup";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;
  private index: Map<string, EmbeddingRecord> = new Map();

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const query = String(input.query ?? "").trim();
      const providedEmbedding = this.normalizeEmbedding(input.query_embedding ?? input.embedding);
      const topK = this.clampNumber(input.top_k, 1, 50, 5);
      const minScore = this.clampNumber(input.min_score, 0, 1, 0.2);

      if (Array.isArray(input.index)) {
        this.loadIndex(input.index);
      }

      const queryEmbedding = providedEmbedding.length ? providedEmbedding : this.hashEmbedding(query, 16);
      const matches = this.searchIndex(queryEmbedding, minScore)
        .slice(0, topK)
        .map((match) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata
        }));

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      const output: EmbeddingLookupOutput = {
        query,
        matches,
        used_index_size: this.index.size
      };

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output,
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "EmbeddingLookup failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 11;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private loadIndex(records: unknown[]): void {
    for (const record of records) {
      const normalized = this.normalizeRecord(record);
      if (!normalized) continue;
      this.index.set(normalized.id, normalized);
    }
  }

  private searchIndex(queryEmbedding: number[], minScore: number): Array<EmbeddingMatch> {
    const matches: EmbeddingMatch[] = [];
    for (const record of this.index.values()) {
      const score = this.cosineSimilarity(queryEmbedding, record.embedding);
      if (score >= minScore) {
        matches.push({ id: record.id, score: this.roundTo(score, 4), metadata: record.metadata });
      }
    }
    return matches.sort((a, b) => b.score - a.score);
  }

  private normalizeRecord(record: unknown): EmbeddingRecord | null {
    if (!record || typeof record !== "object") return null;
    const id = String((record as EmbeddingRecord).id ?? "").trim();
    if (!id) return null;
    const embedding = this.normalizeEmbedding((record as EmbeddingRecord).embedding);
    if (!embedding.length) return null;
    return {
      id,
      embedding,
      metadata: (record as EmbeddingRecord).metadata
    };
  }

  private normalizeEmbedding(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value.map((val) => Number(val)).filter((val) => Number.isFinite(val));
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const length = Math.min(vecA.length, vecB.length);
    if (!length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < length; i += 1) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private hashEmbedding(text: string, size: number): number[] {
    const embedding = new Array(size).fill(0);
    if (!text) return embedding;
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const hash = this.hashString(token);
      embedding[hash % size] += 1;
    }
    const norm = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));
    return norm ? embedding.map((val) => val / norm) : embedding;
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 37 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  private roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

if (require.main === module) {
  const tool = new EmbeddingLookup();
  console.log("[AE3:EmbeddingLookup] Testing EmbeddingLookup...\n");

  tool
    .execute({
      query: "customer churn risk",
      index: [
        { id: "vec-1", embedding: [0.1, 0.2, 0.4, 0.1], metadata: { topic: "risk" } },
        { id: "vec-2", embedding: [0.9, 0.1, 0.1, 0.2], metadata: { topic: "sales" } }
      ],
      top_k: 2
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:EmbeddingLookup] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:EmbeddingLookup] Test failed", error);
    });
}
