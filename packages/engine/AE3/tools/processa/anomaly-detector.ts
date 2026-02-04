import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type AnomalyResult = {
  score: number;
  is_anomaly: boolean;
  threshold: number;
  method: "zscore" | "iqr" | "isolation";
  stats: {
    mean: number;
    std_dev: number;
    median: number;
    iqr: number;
    sample_size: number;
  };
  details: {
    z_score?: number;
    iqr_score?: number;
  };
};

export class AnomalyDetector implements Tool {
  id = "T29";
  name = "AnomalyDetector";
  phase = "processa" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const values = this.normalizeSeries(input.series ?? input.values ?? []);
      const threshold = this.clampNumber(input.threshold, 0.1, 10, 2.5);
      const method = this.normalizeMethod(input.method);
      const target = this.extractTarget(input, values);

      const stats = this.computeStats(values);
      const zScore = stats.std_dev ? Math.abs((target - stats.mean) / stats.std_dev) : 0;
      const iqrScore = stats.iqr ? this.computeIqrScore(target, stats.median, stats.iqr) : 0;

      let score = zScore;
      if (method === "iqr") score = iqrScore;
      if (method === "isolation") score = this.isolationScore(target, stats.mean, stats.std_dev);

      const result: AnomalyResult = {
        score: this.roundTo(score, 4),
        is_anomaly: score >= threshold,
        threshold,
        method,
        stats,
        details: {
          z_score: this.roundTo(zScore, 4),
          iqr_score: this.roundTo(iqrScore, 4)
        }
      };

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "AnomalyDetector failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 10;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private normalizeSeries(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  private normalizeMethod(value: unknown): AnomalyResult["method"] {
    const method = String(value ?? "zscore").toLowerCase();
    if (method === "iqr" || method === "isolation") return method;
    return "zscore";
  }

  private extractTarget(input: ToolInput, series: number[]): number {
    const direct = Number(input.target ?? input.score);
    if (Number.isFinite(direct)) return direct;
    if (series.length) return series[series.length - 1];
    return 0;
  }

  private computeStats(values: number[]): AnomalyResult["stats"] {
    if (!values.length) {
      return { mean: 0, std_dev: 0, median: 0, iqr: 0, sample_size: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((acc, val) => acc + val, 0) / sorted.length;
    const variance =
      sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / Math.max(sorted.length, 1);
    const stdDev = Math.sqrt(variance);
    const median = this.percentile(sorted, 0.5);
    const q1 = this.percentile(sorted, 0.25);
    const q3 = this.percentile(sorted, 0.75);
    const iqr = q3 - q1;

    return {
      mean: this.roundTo(mean, 4),
      std_dev: this.roundTo(stdDev, 4),
      median: this.roundTo(median, 4),
      iqr: this.roundTo(iqr, 4),
      sample_size: sorted.length
    };
  }

  private percentile(sorted: number[], pct: number): number {
    if (!sorted.length) return 0;
    const index = (sorted.length - 1) * pct;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private computeIqrScore(target: number, median: number, iqr: number): number {
    if (!iqr) return 0;
    return Math.abs(target - median) / iqr;
  }

  private isolationScore(target: number, mean: number, stdDev: number): number {
    const deviation = stdDev ? Math.abs(target - mean) / stdDev : Math.abs(target - mean);
    return this.clampNumber(deviation * 0.9, 0, 10, 0);
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
  const tool = new AnomalyDetector();
  console.log("[AE3:AnomalyDetector] Testing AnomalyDetector...\n");

  tool
    .execute({
      series: [10, 12, 9, 11, 10, 13, 9, 120],
      target: 120,
      method: "zscore",
      threshold: 2.5
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:AnomalyDetector] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:AnomalyDetector] Test failed", error);
    });
}
