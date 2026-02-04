import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type SearchDocument = {
  id: string;
  text: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
};

type SearchResult = {
  id: string;
  score: number;
  snippet: string;
  source: "vector" | "text" | "hybrid";
  breakdown?: {
    text_score?: number;
    vector_score?: number;
  };
  metadata?: Record<string, unknown>;
};

type HybridSearchOutput = {
  query: string;
  results: SearchResult[];
  strategy: {
    text_weight: number;
    vector_weight: number;
  };
};

export class HybridSearch implements Tool {
  id = "T8";
  name = "HybridSearch";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const query = String(input.query ?? "").trim();
      const documents = this.normalizeDocuments(input.documents ?? []);
      const topK = this.clampNumber(input.top_k, 1, 50, 5);
      const weights = this.normalizeWeights(input.text_weight, input.vector_weight);

      if (!query) {
        return this.buildSuccess({ query, results: [], strategy: weights }, startTime);
      }

      const queryEmbedding = this.resolveQueryEmbedding(query, input.query_embedding);
      const textScores = this.rankByText(query, documents);
      const vectorScores = queryEmbedding.length ? this.rankByVector(queryEmbedding, documents) : new Map<string, number>();

      const results = documents
        .map((doc) => {
          const textScore = textScores.get(doc.id) ?? 0;
          const vectorScore = vectorScores.get(doc.id) ?? 0;
          const score = this.roundTo(textScore * weights.text_weight + vectorScore * weights.vector_weight, 4);
          const source = vectorScore && textScore ? "hybrid" : vectorScore ? "vector" : "text";
          return {
            id: doc.id,
            score,
            snippet: this.buildSnippet(doc.text, query),
            source,
            breakdown: { text_score: this.roundTo(textScore, 4), vector_score: this.roundTo(vectorScore, 4) },
            metadata: doc.metadata
          } as SearchResult;
        })
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      const output: HybridSearchOutput = {
        query,
        results,
        strategy: weights
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
        error: error instanceof Error ? error.message : "HybridSearch failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 9;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private buildSuccess(output: HybridSearchOutput, startTime: number): ToolOutput {
    this.successCount += 1;
    this.totalDuration += Date.now() - startTime;
    return {
      tool_id: this.id,
      tool_name: this.name,
      success: true,
      output,
      duration_ms: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  private normalizeDocuments(raw: unknown): SearchDocument[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((doc) => ({
        id: String((doc as SearchDocument).id ?? "").trim(),
        text: String((doc as SearchDocument).text ?? ""),
        embedding: Array.isArray((doc as SearchDocument).embedding)
          ? (doc as SearchDocument).embedding?.map((value) => Number(value)).filter((value) => Number.isFinite(value))
          : undefined,
        metadata: (doc as SearchDocument).metadata
      }))
      .filter((doc) => doc.id && doc.text);
  }

  private normalizeWeights(textWeight: unknown, vectorWeight: unknown): { text_weight: number; vector_weight: number } {
    const text = this.clampNumber(textWeight, 0, 1, 0.6);
    const vector = this.clampNumber(vectorWeight, 0, 1, 0.4);
    const total = text + vector;
    if (total === 0) return { text_weight: 0.6, vector_weight: 0.4 };
    return { text_weight: text / total, vector_weight: vector / total };
  }

  private resolveQueryEmbedding(query: string, provided?: unknown): number[] {
    if (Array.isArray(provided)) {
      return provided.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
    return this.hashEmbedding(query, 12);
  }

  private rankByText(query: string, docs: SearchDocument[]): Map<string, number> {
    const tokens = this.tokenize(query);
    const tokenSet = new Set(tokens);
    const scores = new Map<string, number>();

    for (const doc of docs) {
      const docTokens = this.tokenize(doc.text);
      const matches = docTokens.filter((token) => tokenSet.has(token));
      if (!matches.length) continue;
      const uniqueMatches = new Set(matches);
      const score = uniqueMatches.size / Math.max(1, tokens.length);
      scores.set(doc.id, this.roundTo(score, 4));
    }

    return scores;
  }

  private rankByVector(queryEmbedding: number[], docs: SearchDocument[]): Map<string, number> {
    const scores = new Map<string, number>();
    for (const doc of docs) {
      if (!doc.embedding?.length) continue;
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      if (score > 0) scores.set(doc.id, this.roundTo(score, 4));
    }
    return scores;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  private buildSnippet(text: string, query: string): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text.slice(0, 140);
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + lowerQuery.length + 60);
    return text.slice(start, end).trim();
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
    const tokens = this.tokenize(text);
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
      hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
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
  const tool = new HybridSearch();
  console.log("[AE3:HybridSearch] Testing HybridSearch...\n");

  tool
    .execute({
      query: "forecast risk",
      documents: [
        { id: "doc-1", text: "Market forecast and risk assessment for Q3." },
        { id: "doc-2", text: "User onboarding guide for enterprise accounts." },
        { id: "doc-3", text: "Risk mitigation strategies for supply chain issues." }
      ],
      top_k: 2
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:HybridSearch] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:HybridSearch] Test failed", error);
    });
}
