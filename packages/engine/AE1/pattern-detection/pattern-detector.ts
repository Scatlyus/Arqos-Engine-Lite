import type { Reflection, Pattern, Observation } from "../cognition-loop/loop-types";
import { detectStatisticalPatterns } from "./statistical";

export class PatternDetector {
  constructor(private mode: "lite" | "fullstack") { }

  async detectPatterns(_reflections: Reflection[], observations?: Observation[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // In Lite mode, we only use deterministic statistical analysis
    if (this.mode === "lite" && observations) {
      console.log(`[AE1] Detecting statistical patterns in Lite mode (${observations.length} obs)...`);
      const statsPatterns = detectStatisticalPatterns(observations);
      patterns.push(...statsPatterns);
    }

    // Fullstack: Advanced clustering and anomaly detection
    if (this.mode === "fullstack" && observations) {
      console.log(`[AE1] Detecting advanced patterns in Fullstack mode...`);

      // 1. Rule-based clustering for sequences (P2: Limited depth to prevent performance issues)
      const clusters = this.ruleCluster(observations, {
        limit: 50, // Safety limit for sequence length
        windowMs: 10 * 60 * 1000 // 10 min window
      });
      patterns.push(...clusters);

      // 2. Statistical re-validation
      const statsPatterns = detectStatisticalPatterns(observations);
      patterns.push(...statsPatterns);
    }

    return patterns;
  }

  private ruleCluster(observations: Observation[], options: { limit: number, windowMs: number }): Pattern[] {
    const clusters: Pattern[] = [];
    const recent = observations.slice(-options.limit);

    // Group by type/outcome correlation
    const grouping = new Map<string, number>();
    for (const obs of recent) {
      const key = `${obs.type}:${obs.outcome || "unknown"}`;
      grouping.set(key, (grouping.get(key) || 0) + 1);
    }

    for (const [key, count] of grouping) {
      if (count >= 5) {
        clusters.push({
          id: `cluster_${Date.now()}_${key}`,
          type: "cluster",
          description: `Frequent sequence cluster: ${key} (${count} events)`,
          confidence: Number((count / recent.length).toFixed(2)),
          timestamp: new Date().toISOString()
        });
      }
    }

    return clusters;
  }

  async getRecentPatterns(): Promise<Pattern[]> {
    return [];
  }

  async getRiskIndicators(): Promise<string[]> {
    return [];
  }
}
